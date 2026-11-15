/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Health = {
    status: Health.status;
    database: Health.database;
    /**
     * Собирается `-ldflags`; на локальной сборке — `unknown`.
     */
    version: string;
};
export namespace Health {
    export enum status {
        OK = 'ok',
        ERROR = 'error',
    }
    export enum database {
        CONNECTED = 'connected',
        DISCONNECTED = 'disconnected',
    }
}

