# Production Planning CSV Example

Upload CSV files with the following headers:

```
sku,sellWeek,quantity,recipeVersion
Lavender 10cm,12,100,A1
Rose 2L,15,200,
```

- **sku** – variety and pot size (required)
- **sellWeek** – target sales week (1-52)
- **quantity** – number of units
- **recipeVersion** – optional recipe identifier

Each row will create a draft batch and the system will estimate a predicted ready week two weeks before the sell week.
