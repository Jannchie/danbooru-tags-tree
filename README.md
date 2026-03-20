# danbooru-tags-tree

This repo is a small viewer for the Danbooru tag taxonomy stored here.

The source data lives in `data/source` as YAML and CSV. The app turns that data into browser-friendly JSON, then lets you explore it in two ways:

- a tree view for reading the hierarchy
- a graph view for getting the overall shape

It also includes multilingual labels (`zh-CN`, `en`, `ja`) and tag frequency data, so it is useful when you want to inspect how tags are grouped instead of staring at raw YAML.

## Files that matter

- `data/source/`: taxonomy, translations, and tag frequency source files
- `scripts/build-data.ts`: builds JSON files into `public/output/`
- `src/`: the Vue app

## Run it

```bash
pnpm install
pnpm dev
```

The dev script will build missing data files automatically.

Default local URL:

```text
http://localhost:5832
```

## If you changed the source data

```bash
pnpm build:data
```

## Basic checks

```bash
pnpm test
pnpm lint
pnpm build
```
