# appdate

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

To use: 
- [docs](https://ultrox.github.io/appdate/classes/AppDate.html)

```
npm install @ma.vu/appdate
```
## How?
The pattern follows the Builder/Factory pattern where:

Static methods are the "builders" that create new instances
```ts
// These create NEW instances of AppDate
static now(): AppDate
static fromDateString(date: string): AppDate
static fromLocalTime(time: string): AppDate
static invalid(): AppDate
```

Instance methods are the "operators" that work with existing instances

```ts
// These operate on an EXISTING AppDate instance
add(value: number, unit?: ManipulateType): AppDate
subtract(value: number, unit?: ManipulateType): AppDate
isValid(): boolean
toLocalTime(): string
```


## Why Constructor is private?

The constructor is marked as private for several important reasons:

It ensures all date creation goes through the static factory methods where proper validation happens
It prevents creating AppDate with invalid/unexpected formats
It maintains a single way to create dates, making the code more predictable
It encapsulates the internal dayjs implementation

If we allowed direct construction:
```ts
// If constructor was public:
const date1 = new AppDate('2024-02-11');     // Is this YYYY-MM-DD?
const date2 = new AppDate('02/11/2024');     // What about this format?
const date3 = new AppDate('11.02.2024');     // Or this European format?
```

Instead, with factory methods:

```ts
// Clear intention, validated format
const date = AppDate.fromDateString('2024-02-11');  // Must be YYYY-MM-DD
```
