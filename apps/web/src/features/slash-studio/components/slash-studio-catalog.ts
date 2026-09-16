// Catalogue des onglets, modèles, actions et variables Slash Studio

export type CommandStudioTab =
  | "home"
  | "composer"
  | "structure"
  | "response"
  | "test"
  | "json";

export type CommandTemplateKey =
  | "simple"
  | "embed"
  | "welcome"
  | "goodbye"
  | "logs"
  | "recreate_purge"
  | "autorole"
  | "ban"
  | "unban"
  | "kick"
  | "ticket"
  | "roles"
  | "modal"
  | "announcement"
  | "moderation";

export const commandStudioTabs: Array<{
  key: CommandStudioTab;
  label: string;
}> = [
  { key: "response", label: "Response" },
  { key: "structure", label: "Structure" },
  { key: "test", label: "Test / Preview" },
  { key: "json", label: "JSON avance" },
];

export const commandTemplates: Array<{
  key: CommandTemplateKey;
  title: string;
  description: string;
  action: string;
}> = [
  {
    key: "simple",
    title: "Simple reply",
    description: "Une commande qui repond immediatement avec un message.",
    action: "Reply",
  },
  {
    key: "embed",
    title: "Embed",
    description: "Une reponse riche avec titre, couleur, image et champs.",
    action: "Send embed",
  },
  {
    key: "welcome",
    title: "Welcome channel",
    description: "Configure le salon de bienvenue du serveur.",
    action: "Set welcome",
  },
  {
    key: "goodbye",
    title: "Goodbye channel",
    description: "Configure le salon de départ du serveur.",
    action: "Set goodbye",
  },
  {
    key: "logs",
    title: "Logs channel",
    description: "Configure le salon des logs du serveur.",
    action: "Set logs",
  },
  {
    key: "recreate_purge",
    title: "Purger par recréation",
    description: "Crée /reinitialiser-salon avec confirmation obligatoire.",
    action: "Reset channel",
  },
  {
    key: "autorole",
    title: "Role automation",
    description:
      "Liste, ajoute, supprime et synchronise les rôles automatiques.",
    action: "Auto role",
  },
  {
    key: "ban",
    title: "Ban",
    description: "Bannit un membre avec raison et log personnalisable.",
    action: "Ban member",
  },
  {
    key: "unban",
    title: "Unban",
    description: "Débannit un utilisateur avec son ID Discord.",
    action: "Unban user",
  },
  {
    key: "kick",
    title: "Kick",
    description: "Expulse un membre avec raison et log personnalisable.",
    action: "Kick member",
  },
  {
    key: "ticket",
    title: "Ticket",
    description: "Bouton, creation de salon et message de suivi.",
    action: "Create channel",
  },
  {
    key: "roles",
    title: "Role menu",
    description: "Select menu pour ajouter ou retirer des roles.",
    action: "Add role",
  },
  {
    key: "modal",
    title: "Modal form",
    description: "Formulaire Discord puis handler de soumission.",
    action: "Show modal",
  },
  {
    key: "announcement",
    title: "Announcement",
    description: "Annonce controlee avec preview et follow-up.",
    action: "Send channel message",
  },
  {
    key: "moderation",
    title: "Moderation",
    description: "Permissions, conditions et journalisation.",
    action: "Log action",
  },
];

export const workflowBlocks = [
  {
    title: "Repondre a l'interaction",
    description: "Reply public ou ephemere avec variables.",
    permission: "Use Application Commands",
  },
  {
    title: "Envoyer un embed",
    description: "Utilise l'embed courant et ses composants.",
    permission: "Embed Links",
  },
  {
    title: "Afficher une modal",
    description: "Ouvre un formulaire et expose {modal.field}.",
    permission: "Use Application Commands",
  },
  {
    title: "Définir le welcome",
    description: "Sauvegarde un salon welcome par serveur.",
    permission: "Send Messages",
  },
  {
    title: "Définir le goodbye",
    description: "Sauvegarde un salon goodbye par serveur.",
    permission: "Send Messages",
  },
  {
    title: "Définir les logs",
    description: "Sauvegarde un salon logs par serveur.",
    permission: "View Audit Log",
  },
  {
    title: "Purger par recréation",
    description: "Recrée un salon à l'identique puis supprime l'ancien.",
    permission: "Manage Channels",
  },
  {
    title: "Automatiser les rôles",
    description: "Ajoute un rôle selon messages, vocal ou ancienneté.",
    permission: "Manage Roles",
  },
  {
    title: "Bannir un membre",
    description: "Bannit puis répond avec message simple ou embed.",
    permission: "Ban Members",
  },
  {
    title: "Débannir un membre",
    description: "Retire un bannissement depuis un ID Discord.",
    permission: "Ban Members",
  },
  {
    title: "Expulser un membre",
    description: "Kick puis journalise l’action.",
    permission: "Kick Members",
  },
  {
    title: "Attendre un bouton",
    description: "Branche le workflow sur custom_id auto.",
    permission: "Aucune permission serveur",
  },
  {
    title: "Ajouter un role",
    description: "Ajoute un role cible a l'utilisateur.",
    permission: "Manage Roles",
  },
  {
    title: "Creer un salon",
    description: "Cree un salon ticket avec permissions.",
    permission: "Manage Channels",
  },
  {
    title: "Branche if/else",
    description: "Execute deux chemins selon une condition.",
    permission: "Depend des actions",
  },
  {
    title: "Logger une action",
    description: "Envoie un log dans le salon configure.",
    permission: "Send Messages",
  },
];

export const actionLibrary = [
  [
    "Reply",
    "Repond a l'interaction",
    "Use Application Commands",
    "Interaction deja repondue",
  ],
  [
    "Follow up",
    "Ajoute un message de suivi",
    "Use Application Commands",
    "Webhook expire",
  ],
  [
    "Send channel message",
    "Publie dans un salon",
    "Send Messages",
    "Salon introuvable",
  ],
  [
    "Set welcome channel",
    "Définit le salon welcome",
    "Send Messages",
    "Salon texte invalide",
  ],
  [
    "Set goodbye channel",
    "Définit le salon goodbye",
    "Send Messages",
    "Salon texte invalide",
  ],
  [
    "Set logs channel",
    "Définit le salon logs",
    "View Audit Log",
    "Salon texte invalide",
  ],
  [
    "Role automation",
    "Gère les rôles automatiques",
    "Manage Roles",
    "Rôle au-dessus du bot",
  ],
  [
    "Ban member",
    "Bannit un membre",
    "Ban Members",
    "Rôle cible au-dessus du bot",
  ],
  [
    "Unban user",
    "Débannit un utilisateur",
    "Ban Members",
    "ID utilisateur invalide",
  ],
  [
    "Kick member",
    "Expulse un membre",
    "Kick Members",
    "Rôle cible au-dessus du bot",
  ],
  ["Send DM", "Ouvre un DM utilisateur", "Send Messages", "DM fermes"],
  ["Add role", "Ajoute un role", "Manage Roles", "Role au-dessus du bot"],
  [
    "Remove role",
    "Retire un role",
    "Manage Roles",
    "Role gere par integration",
  ],
  [
    "Create channel",
    "Cree un salon",
    "Manage Channels",
    "Limite de salons atteinte",
  ],
  ["Delete channel", "Supprime un salon", "Manage Channels", "Salon protege"],
  [
    "Edit permissions",
    "Met a jour les overwrites",
    "Manage Roles",
    "Permission refusee",
  ],
  [
    "Show modal",
    "Affiche un formulaire",
    "Use Application Commands",
    "Interaction expiree",
  ],
  [
    "Branch if/else",
    "Choisit un chemin",
    "Depend des branches",
    "Condition invalide",
  ],
  [
    "Store variable",
    "Memorise une valeur",
    "Aucune",
    "Nom de variable invalide",
  ],
];

export const commandVariables = [
  "{user.id}",
  "{user.username}",
  "{user.displayName}",
  "{user.mention}",
  "{guild.id}",
  "{guild.name}",
  "{channel.id}",
  "{channel.name}",
  "{option.nom}",
  "{modal.field}",
  "{button.value}",
  "{select.values}",
  "{timestamp}",
  "{random}",
  "{workflow.step}",
  "{custom.ticketId}",
];

