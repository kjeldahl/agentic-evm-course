import {Request, Response, Router} from 'express';
import {WebApiSetup} from '@event-driven-io/emmett-expressjs';
import {assertNotEmpty} from '../../../util/assertions';
import {
    PlaceReservationCommand,
    generateConfirmationCode,
    handlePlaceReservation,
} from './PlaceReservationCommand';

export const api = (): WebApiSetup => (router: Router): void => {

    /**
     * @openapi
     * /api/placereservation:
     *   post:
     *     summary: Place a reservation
     *     description: >
     *       Places a reservation for a guest. The confirmationCode is generated
     *       server-side and returned in the response — it is not supplied by the
     *       caller. Rejected when the same guest already has a reservation for
     *       the same start and end.
     *     tags: [Reservations]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [email, start, end, numberOfPeople]
     *             properties:
     *               email:
     *                 type: string
     *                 example: ida@example.com
     *               start:
     *                 type: string
     *                 example: 14.03.2026 18:00
     *               end:
     *                 type: string
     *                 example: 14.03.2026 20:00
     *               numberOfPeople:
     *                 type: number
     *                 example: 4
     *     responses:
     *       201:
     *         description: Reservation placed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 ok:
     *                   type: boolean
     *                 confirmationCode:
     *                   type: string
     *                   example: C0NF1RM-0042
     *                 next_expected_stream_version:
     *                   type: string
     *                 last_event_global_position:
     *                   type: string
     *       409:
     *         description: No duplicates allowed
     *       500:
     *         description: Server error
     */
    router.post('/api/placereservation', async (req: Request, res: Response) => {
        // confirmationCode is generated here, not supplied by the caller —
        // slice.json marks it generated / idAttribute on ReservationPlaced.
        const confirmationCode = generateConfirmationCode();
        const correlationId = req.header('correlation_id') ?? confirmationCode;

        try {
            const command: PlaceReservationCommand = {
                type: 'PlaceReservation',
                data: {
                    confirmationCode,
                    email: assertNotEmpty(req.body?.email),
                    start: assertNotEmpty(req.body?.start),
                    end: assertNotEmpty(req.body?.end),
                    numberOfPeople: assertNotEmpty(req.body?.numberOfPeople),
                },
                metadata: {
                    correlation_id: correlationId,
                    causation_id: confirmationCode,
                },
            };

            // Stream is keyed by the guest's email: the "No duplicates allowed"
            // spec replays that guest's earlier reservations before deciding.
            const result = await handlePlaceReservation(command.data.email, command);

            res.set('correlation_id', correlationId);
            res.set('causation_id', confirmationCode);

            return res.status(201).json({
                ok: true,
                confirmationCode,
                next_expected_stream_version: result.nextExpectedStreamVersion?.toString(),
                last_event_global_position: result.lastEventGlobalPosition?.toString(),
            });
        } catch (err: any) {
            const errorMessage = errorMapping(err?.code);
            if (errorMessage) {
                return res.status(409).json({error: errorMessage});
            }
            console.error(err);
            return res.status(500).json({ok: false, error: 'Server error'});
        }
    });
};

const errorMapping = (code: string): string | null => {
    switch (code) {
        case 'duplicate_reservation':
            return 'No duplicates allowed.';
        default:
            return null;
    }
};
