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
```
npm install @ma.vu/appdate
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
