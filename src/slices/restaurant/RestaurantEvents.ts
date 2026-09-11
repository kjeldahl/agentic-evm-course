import type {Event} from '@event-driven-io/emmett';

type CommonMeta = {
    stream_name?: string;
    userId?: string;
    correlation_id?: string;
    causation_id?: string;
};

/**
 * Fields are taken verbatim from
 * .build-kit/.slices/reservations/placereservation/slice.json (events[0]).
 * confirmationCode is the idAttribute and is generated (mapping: "derived:code()").
 */
export type ReservationPlaced = Event<'ReservationPlaced', {
    confirmationCode: string;
    email: string;
    start: string;
    end: string;
    numberOfPeople: number;
}, CommonMeta>;

export type RestaurantEvents = ReservationPlaced;
