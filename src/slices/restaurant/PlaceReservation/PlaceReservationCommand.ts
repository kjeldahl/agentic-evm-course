import type {Command} from '@event-driven-io/emmett';
import {CommandHandler} from '@event-driven-io/emmett';
import {randomUUID} from 'crypto';
import {type RestaurantEvents} from '../RestaurantEvents';
import {findEventstore} from '../../../common/loadPostgresEventstore';

/**
 * Command fields come from slice.json commands[0].fields: email, start, end,
 * numberOfPeople — all mapping "user-input".
 *
 * confirmationCode is NOT user input: slice.json declares it on the event as
 * generated / idAttribute with mapping "derived:code()". It is minted at the
 * edge (see routes.ts) and carried on the command so that `decide` stays pure.
 */
export type PlaceReservationCommand = Command<'PlaceReservation', {
    confirmationCode: string;
    email: string;
    start: string;
    end: string;
    numberOfPeople: number;
}, {
    correlation_id?: string;
    causation_id?: string;
}>;

/**
 * Spec "No duplicates allowed" and "Can place to separate reservations" both
 * replay an earlier ReservationPlaced before issuing the command, so the
 * decision needs the reservations already placed for this guest.
 */
export type PlaceReservationState = {
    placed: {email: string; start: string; end: string}[];
};

export const PlaceReservationInitialState = (): PlaceReservationState => ({
    placed: [],
});

export const evolve = (
    state: PlaceReservationState,
    event: RestaurantEvents,
): PlaceReservationState => {
    const {type} = event;

    switch (type) {
        case 'ReservationPlaced':
            return {
                ...state,
                placed: [...state.placed, {
                    email: event.data.email,
                    start: event.data.start,
                    end: event.data.end,
                }],
            };
        default:
            return state;
    }
};

export const decide = (
    command: PlaceReservationCommand,
    state: PlaceReservationState,
): RestaurantEvents[] => {
    const {confirmationCode, email, start, end, numberOfPeople} = command.data;

    // spec: "No duplicates allowed"
    const isDuplicate = state.placed.some(
        (r) => r.email === email && r.start === start && r.end === end,
    );
    if (isDuplicate) {
        throw {code: 'duplicate_reservation', message: 'No duplicates allowed'};
    }

    return [{
        type: 'ReservationPlaced',
        data: {confirmationCode, email, start, end, numberOfPeople},
        metadata: {
            correlation_id: command.metadata?.correlation_id,
            causation_id: command.metadata?.causation_id,
        },
    }];
};

export const generateConfirmationCode = (): string =>
    randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

const PlaceReservationCommandHandler = CommandHandler<PlaceReservationState, RestaurantEvents>({
    evolve,
    initialState: PlaceReservationInitialState,
});

export const handlePlaceReservation = async (id: string, command: PlaceReservationCommand) => {
    const eventStore = await findEventstore();
    const result = await PlaceReservationCommandHandler(
        eventStore,
        id,
        (state: PlaceReservationState) => decide(command, state),
    );
    return {
        nextExpectedStreamVersion: result.nextExpectedStreamVersion,
        lastEventGlobalPosition: result.lastEventGlobalPosition,
    };
};
