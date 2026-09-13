import {after, before, beforeEach, describe, it} from 'node:test';
import {PostgreSQLProjectionAssert, PostgreSQLProjectionSpec} from '@event-driven-io/emmett-postgresql';
import {PostgreSqlContainer, StartedPostgreSqlContainer} from '@testcontainers/postgresql';
import knex, {Knex} from 'knex';
import assert from 'assert';
import {ActiveReservationViewProjection, tableName} from './ActiveReservationViewProjection';
import {runFlywayMigrations} from '../../../common/testHelpers';

const CODE = 'C0NF1RM-0042';

const placed = {
    type: 'ReservationPlaced' as const,
    data: {
        confirmationCode: CODE,
        email: 'ida@example.com',
        start: '2026-03-14T18:00:00.000Z',
        end: '2026-03-14T20:00:00.000Z',
        numberOfPeople: 4,
    },
    metadata: {stream_name: `restaurant-${CODE}`},
};

const cancelled = {
    type: 'ReservationCancelled' as const,
    data: {confirmationCode: CODE},
    metadata: {stream_name: `restaurant-${CODE}`},
};

describe('ActiveReservationView Specification', () => {
    let postgres: StartedPostgreSqlContainer;
    let connectionString: string;
    let db: Knex;
    let given: PostgreSQLProjectionSpec<any>;

    before(async () => {
        postgres = await new PostgreSqlContainer('postgres').start();
        connectionString = postgres.getConnectionUri();
        db = knex({client: 'pg', connection: connectionString});

        await runFlywayMigrations(connectionString);

        given = PostgreSQLProjectionSpec.for({
            projection: ActiveReservationViewProjection,
            connectionString,
        });
    });

    // The container is shared by every test in this suite, so reset the read
    // model between them — otherwise "empty list" sees the previous test's row.
    beforeEach(async () => {
        await db(tableName).withSchema('public').delete();
    });

    after(async () => {
        await db?.destroy();
        await postgres?.stop();
    });

    const rows = async (connStr: string) => {
        const queryDb = knex({client: 'pg', connection: connStr});
        try {
            return await queryDb(tableName).withSchema('public').select('*');
        } finally {
            await queryDb.destroy();
        }
    };

    it('spec: UI shows active reservations', async () => {
        const assertReadModel: PostgreSQLProjectionAssert = async ({connectionString: connStr}) => {
            const result = await rows(connStr);
            assert.strictEqual(result.length, 1, 'one reservation should be listed');
            assert.strictEqual(result[0].confirmation_code, CODE);
            assert.strictEqual(result[0].email, 'ida@example.com');
            assert.strictEqual(result[0].number_of_people, 4);
            assert.strictEqual(result[0].status, 'ACTIVE');
        };

        await given([placed]).when([]).then(assertReadModel);
    });

    it('spec: Show an empty list if no reservations are made', async () => {
        const assertReadModel: PostgreSQLProjectionAssert = async ({connectionString: connStr}) => {
            const result = await rows(connStr);
            assert.strictEqual(result.length, 0, 'list should be empty');
        };

        await given([]).when([]).then(assertReadModel);
    });

    it('spec: Cancelled reservations are not shown', async () => {
        const assertReadModel: PostgreSQLProjectionAssert = async ({connectionString: connStr}) => {
            const result = await rows(connStr);
            assert.strictEqual(result.length, 0, 'cancelled reservation should not be listed');
        };

        await given([placed, cancelled]).when([]).then(assertReadModel);
    });
});
