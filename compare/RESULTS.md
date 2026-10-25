# Results

Measured 2026-10-25 with Chrome/155.0.0.0, Node v26.10.0. Medians of 9 runs (load) and of 10 runs × 3 pages × 4 rotated rounds (runtime; under load, one 5-second run per round).

## Load on a slow phone

Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. "Ready" = the real content is on screen (the watchlist and chart, or the grid). "Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.

### Over HTTP/1.1

| Trading | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 20.1 | **9.6** | 71.1 | 29.2 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 928 | **732** | 1084 | 880 |
| Ready (ms) | 727.1 | **550.3** | 901.8 | 689.8 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| Spreadsheet | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 21.4 | **9.4** | 70.8 | 28.9 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 784 | **632** | 924 | 764 |
| Ready (ms) | 642.3 | **496** | 813 | 615.2 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

### Over HTTP/2

| Trading | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 20.1 | **9.6** | 71.1 | 29.2 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 804 | **740** | 1076 | 884 |
| Ready (ms) | 622.1 | **554.4** | 900.9 | 697.2 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| Spreadsheet | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 21.4 | **9.4** | 70.8 | 28.9 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 716 | **628** | 964 | 764 |
| Ready (ms) | 581.8 | **496.9** | 830.6 | 605.9 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

## Runtime (ms, lower is better)

Desktop CPU. Time from the call (or click) to the DOM updated and laid out; best per row in bold.

### Trading

| Operation | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| step: 40 of 40 symbols | **9.2** | 9.3 | 10.3 | 10.9 |
| switch symbol | 8 | 8.1 | **7.8** | 7.9 |
| step: 1,000 of 1,000 symbols | **223.4** | 229.1 | 331.1 | 284.4 |
| step: 10 of 1,000 symbols | **3.3** | 3.5 | 7.4 | 3.9 |

### Spreadsheet

| Operation | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| fill demo data | 36.8 | 35.8 | **30.6** | 34.3 |
| Edit A1 (1,000-deep chain) | 3.5 | **3.4** | 5.4 | 4.6 |
| edit one cell nobody reads | **0.9** | **0.9** | 5.4 | 1.8 |
| scroll one screen | 6.3 | **6.2** | 6.8 | 6.5 |
| clear | 10.6 | 10.6 | **4** | 76.7 |

## Under load

Sustained work for 5 seconds while every frame is recorded. Frames per second (higher is better), the median and 95th-percentile frame time, and long tasks (main-thread work over 50 ms).

### Trading: 1,000 symbols, 40 ticking per step, 60 steps/s

|  | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| Frames per second | 27.1 | **27.8** | 26.9 | 27.1 |
| Frame, median (ms) | 33.4 | **33.3** | 33.4 | 33.4 |
| Frame, 95th percentile (ms) | **50** | **50** | 50.1 | 50.1 |
| Long tasks | 3 | **2.5** | 4 | 3 |
| Long-task time (ms) | 170.5 | **156.5** | 220 | 178.5 |

### Trading: 1,000 symbols, all ticking, 60 steps/s

|  | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| Frames per second | 4.5 | 4.8 | **5.4** | 4.4 |
| Frame, median (ms) | 208.3 | **200** | 208.3 | 225 |
| Frame, 95th percentile (ms) | 291.6 | **258.4** | 300 | 283.3 |
| Long tasks | **24** | 25 | 27.5 | 29.5 |
| Long-task time (ms) | 4370 | **4249** | 4313 | 4401.5 |

### Spreadsheet: 100 random edits/s on the demo data

|  | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| Frames per second | **59.7** | **59.7** | **59.7** | **59.7** |
| Frame, median (ms) | **16.7** | **16.7** | **16.7** | **16.7** |
| Frame, 95th percentile (ms) | **16.7** | 16.8 | 16.8 | 16.8 |
| Long tasks | **0** | **0** | **0** | **0** |
| Long-task time (ms) | **0** | **0** | **0** | **0** |

## Memory (JS heap after GC, MB, lower is better)

### Trading

| State | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| 40 symbols | 1.1 | **1.05** | 1.59 | 1.54 |
| 1,000 symbols | 5.11 | **5.06** | 5.61 | 8.23 |
| 1,000 symbols after 2,000 steps | 5.7 | **5.65** | 10.11 | 8.87 |

### Spreadsheet

| State | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| empty | 1.24 | **1.21** | 1.52 | 1.38 |
| demo data | 5.11 | 5.07 | **3.09** | 5.07 |

## Code (lines of app code, without comments and blank lines)

The shared code (the feed, the chart geometry, the formula engine, the formatting) is the same for all and not counted.

| App | Pith | React | Vue |
|---|---:|---:|---:|
| Trading | **207** | 245 | 247 |
| Spreadsheet | 227 | **188** | 227 |

## Developer experience

|  | Pith | React | Vue |
|---|---:|---:|---:|
| npm packages to install | 0 | 19 | 35 |
| node_modules size (MB) | 0 | 41 | 49 |
| Build step | none | Vite | Vite |
| Production build of Trading (ms) | 0 | 364 | 345 |
| Config files | 0 | 1 (vite.config.js) | 1 (vite.config.js) |
