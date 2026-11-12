import { CatalogueStorageError, checkCatalogueStorage } from '../src/lib/telegram-store.ts';
try {
  console.log(JSON.stringify(await checkCatalogueStorage()));
} catch (error) {
  console.error(error instanceof CatalogueStorageError ? `${error.code}: ${error.message}` : `Contrôle impossible : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
  process.exitCode=1;
}
