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

## Where the Chinese comes from

`zh-CN` on tag entries is **not** owned here. It is pulled from
[`danbooru-tag-index`](https://github.com/Jannchie/danbooru-tag-index), which is
the only project of the three sharing this data that reviews it -- it has a
hand-checked correction file, a rejection list that can drop a wrong name
outright, and post counts to prioritise by.

```bash
pnpm sync:zh              # after that project regenerates display_names.json
pnpm sync:zh --dry-run    # see what would change first
```

Chinese used to originate here, get copied into the pictoria image library, and
get imported from there back into danbooru-tag-index -- a loop with no owner,
where a correction reached the other two only by accident. It showed: `censored`
sat here as 已遮挡 and `uncensored` as 无遮挡 long after they were fixed to
已打码 / 无码 upstream.

Everything else stays owned here and the sync never touches it: `ja` (the index
has no Japanese for general tags), the 888 `category.*` node names, and the tree
itself. Tags the index has no Chinese name for keep the one they have -- this
repo reaches further down the long tail than its post-count floor.

## Basic checks

```bash
pnpm test
pnpm lint
pnpm build
```
