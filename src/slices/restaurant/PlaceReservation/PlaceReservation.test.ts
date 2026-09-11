import {DeciderSpecification} from '@event-driven-io/emmett';
import {describe, it} from 'node:test';
import {
    PlaceReservationCommand,
    PlaceReservationInitialState,
    decide,
    evolve,
} from './PlaceReservationCommand';

describe('PlaceReservation Specification', () => {
    const given = DeciderSpecification.for({
        decide,
        evolve,
        initialState: PlaceReservationInitialState,
    });

    const placed = (
        confirmationCode: string,
        start: string,
        end: string,
        numberOfPeople: number,
    ) => ({
        type: 'ReservationPlaced' as const,
        data: {confirmationCode, email: 'ida@example.com', start, end, numberOfPeople},
        metadata: {},
    });

    const command = (
        confirmationCode: string,
        start: string,
        end: string,
        numberOfPeople: number,
    ): PlaceReservationCommand => ({
        type: 'PlaceReservation',
        data: {confirmationCode, email: 'ida@example.com', start, end, numberOfPeople},
        metadata: {},
    });

    it('spec: A reservation is placed', () => {
        given([])
            .when(command('C0NF1RM-0042', '14.03.2026 18:00', '14.03.2026 20:00', 4))
            .then([{
                type: 'ReservationPlaced',
                data: {
                    confirmationCode: 'C0NF1RM-0042',
                    email: 'ida@example.com',
                    start: '14.03.2026 18:00',
                    end: '14.03.2026 20:00',
                    numberOfPeople: 4,
                },
                metadata: {correlation_id: undefined, causation_id: undefined},
            }]);
    });

    it('spec: No duplicates allowed', () => {
        given([placed('C0NF1RM-0042', '14.03.2026 18:00', '14.03.2026 20:00', 4)])
            .when(command('C0NF1RM-0043', '14.03.2026 18:00', '14.03.2026 20:00', 4))
            .thenThrows();
    });

    it('spec: Can place to separate reservations', () => {
        given([placed('C0NF1RM-0042', '14.03.2026 18:00', '14.03.2026 20:00', 4)])
            .when(command('C0NF1RM-0084', '15.03.2026 18:00', '15.03.2026 20:00', 2))
            .then([{
                type: 'ReservationPlaced',
                data: {
                    confirmationCode: 'C0NF1RM-0084',
                    email: 'ida@example.com',
                    start: '15.03.2026 18:00',
                    end: '15.03.2026 20:00',
                    numberOfPeople: 2,
                },
                metadata: {correlation_id: undefined, causation_id: undefined},
            }]);
    });
});
