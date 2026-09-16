// Structure racine Next

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Botdeck",
	description: "A local Discord bot cockpit for developers.",
	icons: {
		icon: [
			{ url: "/favicon.ico", sizes: "any" },
			{ url: "/app-icon.png", type: "image/png", sizes: "128x128" }
		],
		shortcut: "/favicon.ico",
		apple: "/app-icon.png"
	}
};

export default function RootLayout({
	children
}: Readonly<{
	children: ReactNode;
}>) {
	return (
		<html lang="fr" suppressHydrationWarning>
			<body>{children}</body>
		</html>
	);
}
