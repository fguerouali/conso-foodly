# Foodly — Consommation crue

Page unique pour lire un export caisse du mois et afficher trois indicateurs :

- viande crue = quantité × grammes de viande cuite × 1,4
- poulet cru = quantité × grammes de poulet cuit × 1,3
- tender cru = quantité × grammage tender du barème

Les quantités viennent de la feuille `VENTES_PAR_PRODUIT`. Le barème (grammes par portion) est celui de la feuille `formule` d’octobre 2026.

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

Déploiement statique. Le fichier `render.yaml` décrit le service : build `npm install && npm run build`, dossier `dist`.

## Barème

Seuls les 36 produits du barème de référence sont comptés. Un produit absent de ce tableau ne consomme ni viande, ni poulet, ni tender.
