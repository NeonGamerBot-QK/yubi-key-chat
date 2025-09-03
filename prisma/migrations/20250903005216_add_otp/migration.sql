-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nic_name" TEXT NOT NULL,
    "yubikeyOtp" TEXT NOT NULL,
    "devices" JSONB NOT NULL DEFAULT []
);

-- CreateTable
CREATE TABLE "passkeys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "passkey_id" TEXT NOT NULL,
    "public_key" BLOB NOT NULL,
    "user_id" INTEGER NOT NULL,
    "webauthnUser_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "device_type" TEXT NOT NULL,
    "back_up" BOOLEAN NOT NULL,
    "devices" JSONB NOT NULL
);
