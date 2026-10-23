# Results

Measured 2026-10-23 with Chrome/155.0.0.0, Node v26.10.0. Medians of 5 runs (load) and 10 runs × 3 pages × 4 rotated rounds (runtime).

## Load on a slow phone

Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. "Ready" = the page's real content is on screen (todos, stats, or table rows). "Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.

### Over HTTP/1.1

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 10.8 | **6.7** | 67.2 | 26 |
| JS files | 3 | **1** | **1** | **1** |
| First paint (ms) | **536** | 548 | 860 | 652 |
| Ready (ms) | 468.1 | **467** | 800.1 | 578.8 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **10.8** | 11.1 | 97.9 | 37.1 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | 496 | **492** | 1028 | 648 |
| Ready (ms) | 982.8 | **830.6** | 1388 | 1008.2 |
| Blocking (ms) | **0** | 7 | 39 | 42 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **11.4** | 11.5 | 98.3 | 37.6 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | **496** | 516 | 964 | 648 |
| Ready (ms) | 1014.3 | **872.1** | 1359.7 | 1044.6 |
| Blocking (ms) | **0** | 16 | 8 | 37 |

### Over HTTP/2

| `todo` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 10.8 | **6.7** | 67.2 | 26 |
| JS files | 3 | **1** | **1** | **1** |
| First paint (ms) | **548** | 552 | 860 | 644 |
| Ready (ms) | 478 | **463.8** | 789.6 | 571.9 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| `crm` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **10.8** | 11.1 | 97.9 | 37.1 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | **492** | 500 | 996 | 668 |
| Ready (ms) | 989.7 | **837.4** | 1357.8 | 1028.9 |
| Blocking (ms) | **0** | 5 | 19 | 50 |

| `crm/customers` | Mini | Mini + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | **11.4** | 11.5 | 98.3 | 37.6 |
| JS files | 5 | **3** | 4 | 5 |
| First paint (ms) | 508 | **484** | 968 | 672 |
| Ready (ms) | 1022.7 | **844.1** | 1357.4 | 1073.9 |
| Blocking (ms) | 4 | **0** | 2 | 52 |

## Runtime (ms, lower is better)

js-framework-benchmark-style operations on the bench app, desktop CPU. Time from click to DOM updated and laid out.

| Operation | Mini | Mini + Vite | React | Vue | Mini, fine-grained rows |
|---|---:|---:|---:|---:|---:|
| create 1,000 rows | 51 | 48.3 | 50.6 | 48.2 | **47.2** |
| replace 1,000 rows | 58 | 60.4 | 58.9 | **54.8** | 60.7 |
| update every 10th row | 19.2 | 22.2 | 16.2 | 16.5 | **14.1** |
| select a row | **0.3** | **0.3** | 1.2 | 2.5 | **0.3** |
| swap two rows | **5.7** | 5.8 | 47.8 | 8.5 | 5.8 |
| remove a row | 5.1 | **5** | 5.4 | 9.3 | **5** |
| create 10,000 rows | **594.3** | 613.3 | 752.3 | 601.3 | 613.5 |
| append 1,000 rows | 62.8 | 62.6 | 60.1 | 60.3 | **58.3** |
| clear 1,000 rows | 6.5 | 6.6 | 9.4 | 7.6 | **6.3** |

"Mini, fine-grained rows" is the same Mini app with each row's label as a signal (bench/mini-fine), an opt-in pattern for big, busy lists. "Mini" is the default way to write it.

### Mini before and after the optimization pass

Same session, old and new Mini alternated 6 times (medians), so session-to-session noise cancels out.
Measured 2026-10-22, before runs started right after a frame: that timing penalised remove and select, so
their "after" here is worse than in the main table above. The other operations show the pass itself.

| Operation | Mini before | Mini after | change |
|---|---:|---:|---:|
| create 1,000 rows | 76.5 | 66.3 | -13% |
| replace 1,000 rows | 83.9 | 67.7 | -19% |
| update every 10th row | 23.3 | 21.4 | -8% |
| select a row | 1.5 | 2.2 | +47% |
| swap two rows | 59.6 | 7.8 | -87% |
| remove a row | 6.6 | 10.3 | +56% |
| create 10,000 rows | 799.8 | 681.2 | -15% |
| append 1,000 rows | 93.1 | 71 | -24% |
| clear 1,000 rows | 9.4 | 8 | -14% |

## Memory (JS heap, MB, lower is better)

| State | Mini | Mini + Vite | React | Vue | Mini, fine-grained rows |
|---|---:|---:|---:|---:|---:|
| ready | 0.59 | **0.56** | 0.97 | 0.75 | 0.59 |
| 1,000 rows | 1.61 | **1.57** | 2.7 | 2.68 | 2.34 |
| 10,000 rows | 9.24 | **9.21** | 15.71 | 18.28 | 16.07 |
| after 5 create/clear | 0.79 | **0.76** | 1.76 | 1.59 | 0.8 |

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
| Production build of the CRM (ms) | 0 | 400 | 297 |
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
