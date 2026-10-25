# Results

Measured 2026-10-25 with Chrome/155.0.0.0, Node v26.10.0. Medians of 9 runs (load) and of 10 runs × 3 pages × 4 rotated rounds (runtime; under load, one 5-second run per round).

## Load on a slow phone

Fresh browser profile each run, Slow 4G (150 ms RTT, 1.6 Mbps) and 4× CPU slowdown. "Ready" = the real content is on screen (the watchlist and chart, or the grid). "Blocking" = long-task time over 50 ms before ready. Lower is better; best per row in bold.

### Over HTTP/1.1

| Trading | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 20.3 | **9.5** | 71.1 | 29.2 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 892 | **728** | 1056 | 876 |
| Ready (ms) | 698.6 | **545.7** | 890 | 688.7 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| Spreadsheet | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 21.6 | **9.3** | 70.8 | 28.9 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 784 | **624** | 936 | 736 |
| Ready (ms) | 651.2 | **491.3** | 810.1 | 594.9 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

### Over HTTP/2

| Trading | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 20.3 | **9.5** | 71.1 | 29.2 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 800 | **748** | 1060 | 872 |
| Ready (ms) | 617.3 | **548.4** | 882 | 681.5 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

| Spreadsheet | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| JS downloaded (KB, gzip) | 21.6 | **9.3** | 70.8 | 28.9 |
| JS files | 6 | **1** | **1** | **1** |
| First paint (ms) | 716 | **644** | 916 | 748 |
| Ready (ms) | 584 | **501.9** | 809.8 | 605.6 |
| Blocking (ms) | **0** | **0** | **0** | **0** |

## Runtime (ms, lower is better)

Desktop CPU. Time from the call (or click) to the DOM updated and laid out; best per row in bold.

### Trading

| Operation | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| step: 40 of 40 symbols | **8.9** | 9 | 9.7 | 10 |
| switch symbol | 7.8 | 7.8 | 7.5 | **7.2** |
| step: 1,000 of 1,000 symbols | **214.9** | 215.2 | 305 | 262.6 |
| step: 10 of 1,000 symbols | **2.8** | 3 | 8.1 | 3.2 |

### Spreadsheet

| Operation | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| fill demo data | 44.9 | 44.1 | **23** | 29.8 |
| Edit A1 (1,000-deep chain) | 6.2 | 6.2 | 4.4 | **3.9** |
| edit one cell nobody reads | **0.8** | **0.8** | 3.6 | 1.6 |
| scroll one screen | 6.3 | 6.2 | **5.5** | 6.1 |
| clear | 16.1 | 16 | **3.2** | 73.3 |

## Under load

Sustained work for 5 seconds while every frame is recorded. Frames per second (higher is better), the median and 95th-percentile frame time, and long tasks (main-thread work over 50 ms).

### Trading: 1,000 symbols, 40 ticking per step, 60 steps/s

|  | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| Frames per second | 27.2 | **27.5** | 27.4 | 27 |
| Frame, median (ms) | **33.3** | 33.4 | **33.3** | 33.4 |
| Frame, 95th percentile (ms) | **50** | 50.1 | 50.1 | 50.1 |
| Long tasks | 4 | 3 | 3.5 | **2.5** |
| Long-task time (ms) | 233.5 | 177.5 | 194 | **150.5** |

### Trading: 1,000 symbols, all ticking, 60 steps/s

|  | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| Frames per second | 4.8 | 4.9 | **5.7** | 4.6 |
| Frame, median (ms) | 200.1 | 200 | **191.7** | 208.3 |
| Frame, 95th percentile (ms) | **258.3** | **258.3** | 283.3 | 275 |
| Long tasks | 25.5 | **25** | 28 | 28.5 |
| Long-task time (ms) | 4167 | 4142 | **4138** | 4306 |

### Spreadsheet: 100 random edits/s on the demo data

|  | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| Frames per second | 59.6 | **59.7** | **59.7** | **59.7** |
| Frame, median (ms) | **16.7** | **16.7** | **16.7** | **16.7** |
| Frame, 95th percentile (ms) | 16.8 | 16.8 | **16.7** | 16.8 |
| Long tasks | **0** | **0** | **0** | **0** |
| Long-task time (ms) | **0** | **0** | **0** | **0** |

## Memory (JS heap after GC, MB, lower is better)

### Trading

| State | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| 40 symbols | 1.24 | **1.19** | 1.59 | 1.54 |
| 1,000 symbols | 8.35 | 8.3 | **5.61** | 8.23 |
| 1,000 symbols after 2,000 steps | 8.88 | **8.83** | 10.13 | 8.87 |

### Spreadsheet

| State | Pith | Pith + Vite | React | Vue |
|---|---:|---:|---:|---:|
| empty | 1.7 | 1.67 | 1.52 | **1.38** |
| demo data | 11.31 | 11.27 | **3.09** | 5.07 |

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
| Production build of Trading (ms) | 0 | 327 | 427 |
| Config files | 0 | 1 (vite.config.js) | 1 (vite.config.js) |
