// Prisma instance unique (Rechargement sans co multiples).
// Chargement paresseux pour éviter de casser le build quand le client Prisma
// n'a pas encore été généré dans un environnement de vérification isolé.

import { createRequire } from "node:module";
import { configureDatabaseUrl } from "./database-url";

type PrismaDelegate = {
	[key: string]: any;
};

type PrismaClientInstance = {
	$disconnect(): Promise<void>;
	$transaction<T>(callback: (transaction: any) => Promise<T>): Promise<T>;
	$transaction<T>(operations: Promise<T>[]): Promise<T[]>;
	$queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
	$executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
	botAccount: PrismaDelegate;
	guild: PrismaDelegate;
	channel: PrismaDelegate;
	user: PrismaDelegate;
	message: PrismaDelegate;
	presence: PrismaDelegate;
	[key: string]: any;
};

type PrismaClientConstructor = new (options?: Record<string, unknown>) => PrismaClientInstance;

const require = createRequire(import.meta.url);

const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClientInstance;
	prismaDatabaseUrl?: string;
};

function loadPrismaClient(): PrismaClientConstructor {
	try {
		return (require("@prisma/client") as { PrismaClient: PrismaClientConstructor }).PrismaClient;
	} catch (error) {
		throw new Error(
			"Prisma Client is not generated. Run `npm ci` or `npm --prefix apps/web run db:generate` before starting Botdeck.",
			{ cause: error }
		);
	}
}

function createPrismaClient(): PrismaClientInstance {
	const databaseConfig = configureDatabaseUrl();
	const currentDatabaseUrl = databaseConfig.url;
	const existingClientMatchesDatabase = globalForPrisma.prisma && globalForPrisma.prismaDatabaseUrl === currentDatabaseUrl;

	if (globalForPrisma.prisma && !existingClientMatchesDatabase) {
		void globalForPrisma.prisma.$disconnect().catch(() => undefined);
		globalForPrisma.prisma = undefined;
		globalForPrisma.prismaDatabaseUrl = undefined;
	}

	if (!globalForPrisma.prisma) {
		const PrismaClient = loadPrismaClient();
		globalForPrisma.prisma = new PrismaClient({
			log: process.env.BOTDECK_PRISMA_LOG_QUERIES === "1" ? ["query", "warn", "error"] : ["warn", "error"]
		});
		globalForPrisma.prismaDatabaseUrl = currentDatabaseUrl;
	}

	return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClientInstance, {
	get(_target, property) {
		return Reflect.get(createPrismaClient(), property);
	}
});
