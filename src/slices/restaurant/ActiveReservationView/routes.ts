import {Request, Response, Router} from 'express';
import {WebApiSetup} from '@event-driven-io/emmett-expressjs';
import {getKnexInstance} from '../../../common/db';
import {ActiveReservationViewReadModel, tableName} from './ActiveReservationViewProjection';

export const api = (): WebApiSetup => (router: Router): void => {

    /**
     * @openapi
     * /api/query/activereservationview-collection:
     *   get:
     *     summary: List active reservations
     *     description: >
     *       Returns the ActiveReservationView read model. Cancelled reservations
     *       are removed from this view, so only active ones are listed. Pass _id
     *       (the confirmation code) to fetch a single reservation.
     *     tags: [Reservations]
     *     parameters:
     *       - in: query
     *         name: _id
     *         required: false
     *         schema:
     *           type: string
     *           example: C0NF1RM-0042
     *         description: Confirmation code of a single reservation
     *     responses:
     *       200:
     *         description: The active reservations
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   confirmation_code: {type: string, example: C0NF1RM-0042}
     *                   email: {type: string, example: ida@example.com}
     *                   start: {type: string, format: date-time}
     *                   end: {type: string, format: date-time}
     *                   number_of_people: {type: number, example: 4}
     *                   status: {type: string, example: ACTIVE}
     *       500:
     *         description: Server error
     */
    router.get('/api/query/activereservationview-collection', async (req: Request, res: Response) => {
        try {
            const id = req.query._id?.toString();
            const db = getKnexInstance();

            const query = db<ActiveReservationViewReadModel>(tableName).withSchema('public').select('*');
            const data = id ? await query.where({confirmation_code: id}) : await query;

            return res.status(200).json(data);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ok: false, error: 'Server error'});
        }
    });
};
