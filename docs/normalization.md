# Ingredient Normalization Spec

Ingredient normalization must be conservative, explainable, and testable. False merges are worse than occasional duplicates because incorrect first-exposure history is harder to repair.

## Inputs And Outputs

Input:

```text
blended prawns, carrot, and corn
```

Output:

```json
[
  { "key": "prawn", "name": "Prawn" },
  { "key": "carrot", "name": "Carrot" },
  { "key": "corn", "name": "Corn" }
]
```

## Processing Order

1. Normalize whitespace.
2. Convert `&` to `and`.
3. Split on commas, semicolons, newlines, plus signs, and standalone `and`.
4. Trim each token.
5. Remove obvious preparation words only when they appear as standalone leading words:
   - `blended`
   - `mashed`
   - `pureed`
   - `steamed`
   - `boiled`
6. Remove trailing punctuation.
7. Lowercase the key.
8. Apply alias mapping.
9. Apply conservative singularization if no alias matched.
10. Dedupe by final key while preserving first occurrence order.
11. Generate display name from the final key unless an alias points to an existing ingredient display name.

## Splitting Rules

Split:

```text
prawn, carrot, corn
prawn and carrot
prawn + carrot
prawn
carrot
```

Do not split inside known multiword aliases or ingredients after alias lookup support exists. For example:

```text
sweet corn
butternut squash
green pea
```

## Singularization Rules

Allowed examples:

```text
prawns -> prawn
carrots -> carrot
berries -> berry
tomatoes -> tomato
potatoes -> potato
```

Do not singularize when unsafe:

```text
bass -> bass
cress -> cress
asparagus -> asparagus
```

The implementation should prefer a small tested ruleset over broad English inflection.

## Alias Rules

Aliases come from the Airtable `Aliases` table.

Examples:

```text
prawns -> prawn
shrimp -> prawn
sweetcorn -> corn
```

Aliases override generic singularization. If `Aliases.Alias Key = shrimp` points to `Prawn`, then `shrimp` must produce key `prawn`.

## Non-Goals

- Do not infer ingredients from dish names.
- Do not classify foods into nutrition categories.
- Do not translate languages in v1.
- Do not decide whether something "counts" toward the 100. If it is entered, it counts.

Examples:

```text
chicken porridge -> chicken porridge
```

The app should not infer `chicken` and `rice` unless the parent types them separately.

## Required Unit Test Cases

| Input | Expected keys |
| --- | --- |
| `blended prawns, carrot, and corn` | `prawn`, `carrot`, `corn` |
| `Prawns` | `prawn` |
| `corn, corn, corn` | `corn` |
| `carrots and prawns` | `carrot`, `prawn` |
| `berries, tomatoes, potatoes` | `berry`, `tomato`, `potato` |
| `bass, cress, asparagus` | `bass`, `cress`, `asparagus` |
| `prawn + carrot` | `prawn`, `carrot` |
| empty string | no keys |
| `!!!` | no keys |
| `sweet corn` with no alias | `sweet corn` |
| `shrimp` with alias to `prawn` | `prawn` |

