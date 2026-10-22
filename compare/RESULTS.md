# Results

Measured 2026-10-22 with Chrome/155.0.0.0, Node v26.10.0. Medians of 5 runs (load) and 10 runs × 3 pages (runtime).

## Load on a slow phone

Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. "Ready" = the page's real content is on screen (todos, stats, or table rows). "Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.

### Over HTTP/1.1

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 30.3 | **6.7** | 67.2 | 26 |
| JS files | 12 | **1** | **1** | **1** |
| First paint (ms) | 780 | **472** | 792 | 584 |
| Ready (ms) | 718.1 | **416.3** | 744.7 | 531.3 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 30.3 | **11** | 97.9 | 37.1 |
| JS files | 14 | **3** | 4 | 5 |
| First paint (ms) | 748 | **472** | 948 | 632 |
| Ready (ms) | 1230.8 | **801.4** | 1296.6 | 990.5 |
| Blocking (ms) | **0** | **0** | 2 | 32 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 30.8 | **11.4** | 98.3 | 37.6 |
| JS files | 14 | **3** | 4 | 5 |
| First paint (ms) | 748 | **468** | 948 | 644 |
| Ready (ms) | 1248.4 | **817** | 1344.3 | 1033.9 |
| Blocking (ms) | **0** | **0** | 2 | 33 |

### Over HTTP/2

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 30.3 | **6.7** | 67.2 | 26 |
| JS files | 12 | **1** | **1** | **1** |
| First paint (ms) | 652 | **476** | 804 | 592 |
| Ready (ms) | 587.9 | **416.5** | 757.4 | 538.5 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 30.3 | **11** | 97.9 | 37.1 |
| JS files | 14 | **3** | 4 | 5 |
| First paint (ms) | 612 | **480** | 952 | 644 |
| Ready (ms) | 1100.7 | **808.5** | 1293.4 | 994.5 |
| Blocking (ms) | **0** | **0** | **0** | 34 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 30.8 | **11.4** | 98.3 | 37.6 |
| JS files | 14 | **3** | 4 | 5 |
| First paint (ms) | 604 | **476** | 948 | 640 |
| Ready (ms) | 1106.7 | **830.3** | 1338.3 | 1035.8 |
| Blocking (ms) | **0** | **0** | **0** | 32 |

## Runtime (ms, lower is better)

js-framework-benchmark-style operations on the bench app, desktop CPU. Time from click to DOM updated and laid out.

| Operation | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| create 1,000 rows | **42.7** | 44.2 | 44 | 42.9 |
| replace 1,000 rows | 53.4 | 53.6 | 52.8 | **49.1** |
| update every 10th row | 16.2 | 16.4 | **13.5** | 15.1 |
| select a row | **0.4** | **0.4** | 1.1 | 2.4 |
| swap two rows | **4.8** | **4.8** | 41.2 | 7.1 |
| remove a row | 5.1 | **4.3** | 4.6 | 7.9 |
| create 10,000 rows | 562.1 | 568.8 | 708 | **506.5** |
| append 1,000 rows | 56.9 | 52.9 | **50.3** | 56 |
| clear 1,000 rows | **6.6** | 6.8 | 8.3 | 7.5 |

### Mini before and after the optimization pass

Same session, old and new Mini alternated 6 times (medians), so session-to-session noise cancels out.

| Operation | Mini before | Mini after | change |
|---|---:|---:|---:|
| create 1,000 rows | 76.5 | 66.30000000000001 | -13% |
| replace 1,000 rows | 83.9 | 67.65 | -19% |
| update every 10th row | 23.25 | 21.4 | -8% |
| select a row | 1.5 | 2.2 | +47% |
| swap two rows | 59.599999999999994 | 7.75 | -87% |
| remove a row | 6.55 | 10.25 | +56% |
| create 10,000 rows | 799.75 | 681.1500000000001 | -15% |
| append 1,000 rows | 93.1 | 71 | -24% |
| clear 1,000 rows | 9.350000000000001 | 8 | -14% |

## Memory (JS heap, MB, lower is better)

| State | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| ready | 0.59 | **0.56** | 0.97 | 0.75 |
| 1,000 rows | 2.01 | **1.98** | 2.7 | 2.68 |
| 10,000 rows | 13.1 | **12.93** | 15.71 | 18.28 |
| after 5 create/clear | **0.78** | **0.78** | 1.76 | 1.59 |

## Code (lines of app code, without comments and blank lines)

| App | Mini | React | Vue |
|---|---:|---:|---:|
| todo | 109 | 106 | **91** |
| crm | **257** | 406 | 394 |
| bench | 89 | 91 | **82** |

## Developer experience

|  | Mini | React | Vue |
|---|---:|---:|---:|
| npm packages to install | 0 | 22 | 67 |
| node_modules size (MB) | 0 | 44 | 53 |
| Build step | none | Vite | Vite |
| Production build of the CRM (ms) | 0 | 304 | 210 |
| Config files | 0 | 1 (vite.config.js) | 1 (vite.config.js) |

## AI-friendliness

Two feature requests (spec in each task), identical text for every framework. One fresh AI agent per framework and task (same model, no memory of this project), each in its own copy, allowed to edit only that framework's CRM folder, with the same verification tools (build + existing flows). Mini's agents were also pointed to Mini's docs, since no model has Mini in its training data. Graded afterwards with hidden acceptance flows the agents never saw, plus the 11 existing flows for regressions. One run per cell: treat it as a signal, not a statistic.

| Task | Mini | React | Vue |
|---|---:|---:|---:|
| Sortable table: hidden tests passed | **4/4** | **4/4** | **4/4** |
| Sortable table: regressions | none | none | none |
| Sortable table: tokens / tool calls / time | 48.7k / 12 / 94 s | 37.8k / 9 / 75 s | 40.4k / 11 / 75 s |
| Sortable table: lines changed | 26 | 28 | 29 |
| Form rules + counter: hidden tests passed | **6/6** | **6/6** | **6/6** |
| Form rules + counter: regressions | none | none | none |
| Form rules + counter: tokens / tool calls / time | 56.2k / 13 / 105 s | 42.9k / 11 / 82 s | 41.9k / 13 / 116 s |
| Form rules + counter: lines changed | 18 | 10 | 11 |
| Round 2 · Search bug fix: hidden tests passed | **3/3** | **3/3** | **3/3** |
| Round 2 · Search bug fix: regressions | none | none | none |
| Round 2 · Search bug fix: tokens / tool calls / time | 34.4k / 5 / 28 s | 33.1k / 4 / 25 s | 33.1k / 5 / 26 s |
| Round 2 · Search bug fix: lines changed | 6 | 6 | 4 |
| Round 2 · Sortable table (Mini only): hidden tests / tokens / tool calls / time | **4/4** · 51.5k / 11 / 63 s | – | – |
| Round 2 · Form rules + counter (Mini only): hidden tests / tokens / tool calls / time | **6/6** · 48.2k / 10 / 54 s | – | – |

- Every agent succeeded on its first try, including on Mini, which the model had never seen: its docs and checks were enough.
- Mini cost about 15-30% more tokens, mostly spent reading AGENTS.md and the README first.
- The Mini form agent made the live counter work by passing a function as a field hint, which worked but was undocumented (it needed a type cast). That is now an official, tested feature.
- Round 2 (2026-10-22, after Mini gained --state and the state block in failing flows; AGENTS.md grew from 244 to 316 lines). Same setup, one run per cell. Bug task: the same planted bug in all three CRMs (search only updated from 2 characters, so clearing the box kept the list filtered), a visible reproduction flow, graded with hidden flows (clearing restores all, one-letter search filters, search + status combine). Failing Mini flows showed `q = "ada"` under an empty search box; React and Vue showed only the page outline.
- Bug task result: all three fixed it the same way (removed the 2-character rule, citing the spec) in 4–5 tool calls, at about the same cost (Mini +4%). The bug was found by reading one short file, so the state output had no room to help; a bigger app or a bug spread over several files would be a fairer test of it.
- Mini re-run of the old tasks: sortable table 51.5k tokens (was 48.7k), form 48.2k (was 56.2k): no clear change from the bigger AGENTS.md. Round 1's React and Vue numbers came from an earlier session, possibly another model, so don't compare these Mini numbers with them directly. Times also aren't comparable across sessions.
