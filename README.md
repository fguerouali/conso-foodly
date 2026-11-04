# Foodly — Consommation crue

Page unique pour lire les ventes du mois — depuis La Caisse, par ville et par point de vente Foodly, ou depuis un export Excel — et afficher trois indicateurs :

- viande crue = quantité × grammes de viande cuite × 1,4
- poulet cru = quantité × grammes de poulet cuit × 1,3
- tender cru = quantité × grammage tender du barème

Les quantités Excel viennent de la feuille `VENTES_PAR_PRODUIT`. La Caisse lit les mêmes quantités, point de vente par point de vente. Les identifiants du serveur sont `LACAISSE_LOGIN` et `LACAISSE_PASSWORD`.

## Lancer en local

```bash
npm install
npm run dev
```

Le contrôle du fichier d’octobre :

```bash
npm run check
```

Résultat attendu : viande 274,20 kg, poulet 1 063,01 kg, tender 51,04 kg.

## Render

Service Node. Build `npm install && npm run build`, démarrage `npm start`. Renseigner `LACAISSE_LOGIN` et `LACAISSE_PASSWORD` dans l’environnement Render.

## Barème

Seuls les 36 produits du barème de référence sont comptés. Un produit absent de ce tableau ne consomme ni viande, ni poulet, ni tender.
