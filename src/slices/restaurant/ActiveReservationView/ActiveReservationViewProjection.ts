import {postgreSQLRawSQLProjection} from '@event-driven-io/emmett-postgresql';
import {sql, SQL} from '@event-driven-io/dumbo';
import knex, {Knex} from 'knex';
import {type ReservationPlaced, type ReservationCancelled} from '../RestaurantEvents';

export const tableName = 'active_reservation_view';

/**
 * Columns come from the readmodel fields in
 * .build-kit/.slices/restaurant/activereservationview/slice.json.
 * confirmationCode is the idAttribute and therefore the primary key.
 */
export type ActiveReservationViewReadModel = {
    confirmation_code: string;
    email: string;
    start: string;
    end: string;
    number_of_people: number;
    status: string;
};

// Pure SQL builder — no connection string, no pool (see build-state-view Step 3).
export const getKnexInstance = (): Knex => knex({client: 'pg'});

type ActiveReservationViewEvents = ReservationPlaced | ReservationCancelled;

export const ActiveReservationViewProjection = postgreSQLRawSQLProjection<ActiveReservationViewEvents>({
    name: 'ActiveReservationViewProjection',
    canHandle: ['ReservationPlaced', 'ReservationCancelled'],
    evolve: async (event): Promise<SQL[]> => {
        const db = getKnexInstance();

        switch (event.type) {
            case 'ReservationPlaced':
                // spec: "UI shows active reservations" — status is ACTIVE while the row is shown.
                return [sql(db(tableName)
                    .withSchema('public')
                    .insert({
                        confirmation_code: event.data.confirmationCode,
                        email: event.data.email,
                        start: event.data.start,
                        end: event.data.end,
                        number_of_people: event.data.numberOfPeople,
                        status: 'ACTIVE',
                    })
                    .onConflict('confirmation_code')
                    .merge(['email', 'start', 'end', 'number_of_people', 'status'])
                    .toQuery())];

            case 'ReservationCancelled':
                // spec: "Cancelled reservations are not shown" — expectEmptyList, so the row is removed.
                return [sql(db(tableName)
                    .withSchema('public')
                    .where({confirmation_code: event.data.confirmationCode})
                    .delete()
                    .toQuery())];

            default:
                return [];
        }
    },
});
