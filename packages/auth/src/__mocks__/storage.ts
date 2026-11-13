/**
 * Jest stand-in for @creator-hub/storage. AuthService only receives a
 * StorageService through DI, and tests always inject a fake — loading the
 * real package would pull in the AWS SDK and the ESM-only `nanoid`.
 */
export class StorageService {}
export class StorageModule {}
