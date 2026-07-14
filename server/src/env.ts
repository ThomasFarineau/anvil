// Configuration du serveur via variables d'environnement.
// Les identifiants admin servent uniquement au bootstrap : si aucun compte
// admin n'existe en base, il est créé avec ces valeurs (défaut admin:admin).
export const env = {
  port: Number(process.env.PORT ?? 8080),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017/anvil',
  dataDir: process.env.DATA_DIR ?? './data',
  /** Base publique (ex: https://mods.example.com) utilisée pour générer les
   *  URLs absolues des fichiers. Vide = déduit de la requête entrante. */
  publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/+$/, ''),
  adminUsername: process.env.ANVIL_ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ANVIL_ADMIN_PASSWORD ?? 'admin',
};
