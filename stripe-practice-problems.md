# Stripe Interview Practice Problems

Three multi-part problems that mirror the real interview format: practical, parsing-heavy, escalating in complexity. Each should take ~45-60 minutes. Use your preferred language.

---

## Problem 1: Payment Transaction Ledger

You are given a list of transaction strings representing money movements between accounts.

Each transaction is formatted as: `sender,receiver,amount,currency`

Example input:
```
alice,bob,100,usd
bob,charlie,50,usd
charlie,alice,25,usd
alice,bob,75,eur
dave,alice,200,usd
```

### Part A: Parse and compute balances

Parse the transactions and compute the **net balance per account per currency**. A send decreases the balance; a receive increases it.

Expected output for the example above:
```
alice: usd:-100, eur:-75  (sent 100 usd to bob, received 25 usd from charlie, received 200 usd from dave => net usd = +125... let me redo)
```

Actually, just compute it correctly:
- alice: sent 100 usd (to bob), received 25 usd (from charlie), received 200 usd (from dave) => usd: +125. Sent 75 eur (to bob) => eur: -75
- bob: received 100 usd (from alice), sent 50 usd (to charlie) => usd: +50. Received 75 eur (from alice) => eur: +75
- charlie: received 50 usd (from bob), sent 25 usd (to alice) => usd: +25
- dave: sent 200 usd (to alice) => usd: -200

Print each account's balances, sorted alphabetically by account name, then by currency.

### Part B: Validate transactions

Now add validation. A transaction is **invalid** if any of the following are true:
- Missing fields (fewer than 4 comma-separated values)
- `amount` is not a positive integer
- `sender` and `receiver` are the same account
- `currency` is not exactly 3 lowercase letters

Skip invalid transactions and print them separately as errors. Valid transactions should still be processed as in Part A.

### Part C: Minimum transfers to settle debts

After computing net balances (from valid transactions only), determine the **minimum number of transfers** needed to settle all debts so every account has a net balance of zero, **per currency**. Print the settlement plan.

Hint: accounts with positive balances are owed money; accounts with negative balances owe money. Greedily match the largest debtor with the largest creditor.

---

## Problem 2: API Rate Limiter

You are building a rate limiter that processes a log of API requests and determines which ones should be allowed or denied.

Each log entry is formatted as: `timestamp,client_id,endpoint`

Timestamps are integers representing seconds since epoch. The log is sorted by timestamp.

Example input:
```
1,client_a,/api/charges
2,client_a,/api/charges
3,client_a,/api/charges
4,client_a,/api/charges
5,client_b,/api/refunds
6,client_a,/api/charges
```

### Part A: Fixed-window rate limiting

Implement a rate limiter with a **fixed window** of 5 seconds and a limit of 3 requests per client. The window starts at second 0: [0-4], [5-9], [10-14], etc.

For each request, output whether it was `ALLOWED` or `DENIED`.

For the example above:
```
1,client_a,/api/charges -> ALLOWED (1st in window [0-4])
2,client_a,/api/charges -> ALLOWED (2nd)
3,client_a,/api/charges -> ALLOWED (3rd)
4,client_a,/api/charges -> DENIED  (4th, exceeds limit)
5,client_b,/api/refunds -> ALLOWED (1st for client_b in [5-9])
6,client_a,/api/charges -> ALLOWED (1st in new window [5-9])
```

### Part B: Per-endpoint limits

Extend Part A so that rate limits are **per client per endpoint**. The same client can make 3 requests to `/api/charges` AND 3 requests to `/api/refunds` in the same window.

Additionally, support a configurable limit map. The limit map is provided as a separate input:

```
/api/charges,3
/api/refunds,1
*,5
```

Where `*` is the default limit for endpoints not in the map. Apply the most specific matching limit.

### Part C: Sliding window

Replace the fixed window with a **sliding window** of 5 seconds. Instead of predefined windows, each request looks back 5 seconds from its own timestamp. A request at time T is allowed if the client has made fewer than `limit` requests to that endpoint in the interval (T-5, T].

Reprocess the same log and note where results differ from Part B.

---

## Problem 3: Dependency Resolver

You are given a configuration file that defines a set of tasks and their dependencies.

Each line is formatted as: `task_name:dependency1,dependency2,...`

A task with no dependencies has nothing after the colon: `task_name:`

Example input:
```
build:compile,link
compile:parse
link:compile
parse:
test:build
deploy:test,migrate
migrate:
```

### Part A: Parse and display dependencies

Parse the input and print each task with its **full transitive dependency set** (all tasks that must complete before it, directly or indirectly), sorted alphabetically.

Expected output:
```
build: compile, link, parse
compile: parse
deploy: build, compile, link, migrate, parse, test
link: compile, parse
migrate: (none)
parse: (none)
test: build, compile, link, parse
```

### Part B: Detect cycles

Modify your solution to detect **circular dependencies**. If a cycle exists, print the cycle path instead of the dependency set.

Test with this input (which has a cycle):
```
a:b
b:c
c:a
d:e
e:
```

Expected output:
```
Cycle detected: a -> b -> c -> a
```

Your solution should report the first cycle found and stop.

### Part C: Parallel execution plan

Assuming no cycles, compute a **parallel execution plan**: group tasks into "stages" where all tasks in a stage can run simultaneously (all their dependencies are satisfied by prior stages).

Expected output for the original input:
```
Stage 1: migrate, parse
Stage 2: compile
Stage 3: link
Stage 4: build
Stage 5: test
Stage 6: deploy
```

Tasks within a stage should be sorted alphabetically. This is essentially a topological sort grouped by depth.

---

## Tips (read before starting)

1. **Read the entire problem first.** Understand all three parts before writing Part A, so your code is modular enough to extend.
2. **Write helper functions.** A `parse_line()` function in Part A will save you time in Part B.
3. **Use clear variable names.** Stripe evaluates code quality. `client_balances` beats `cb`.
4. **Talk out loud** as you code (practice this even solo). Explain your approach, trade-offs, and why you chose a data structure.
5. **Test with the examples given**, then think of edge cases: empty input, single entry, all invalid, etc.
6. **Correctness first, optimization later.** Get it working, then refactor if time allows.
