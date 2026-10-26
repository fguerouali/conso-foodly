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

Résultat attendu : viande 395,11 kg, poulet 990,05 kg, tender 50,16 kg.

## Render

Déploiement statique. Le fichier `render.yaml` décrit le service : build `npm install && npm run build`, dossier `dist`.

## Barème

Plat gourmand shawarma viande - kabssa et sa version avec mhalabia comptent 120 g de viande cuite, pas de poulet.

Les BOX shawarma, le riz, les frites, le houmous, les mezzés et les desserts ne consomment ni viande, ni poulet, ni tender : ils sont exclus des totaux.
