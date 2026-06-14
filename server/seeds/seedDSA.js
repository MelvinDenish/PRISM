/**
 * PRISM — DSA seed aligned to the CUIC "C.O.D.E" practice sheets (from_cuic/Codes/).
 *
 * Seeds the 7 CUIC DSA topics + representative, REFERENCE-VERIFIED coding
 * questions (gradeable on the Coding Questions tracker and usable as Phase-2
 * path-test seed content), and registers the 7 practice-sheet PDFs as topic
 * resources. Idempotent: upserts by name/title so it can be re-run and run
 * standalone (it does NOT wipe like seedAll / seedQuestionBank).
 *
 *   Run: node seeds/seedDSA.js
 *   (local DB) MONGODB_URI="mongodb://127.0.0.1:27017/prism" node seeds/seedDSA.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Topic = require('../models/Topic');
const Resource = require('../models/Resource');
const CodingQuestion = require('../models/CodingQuestion');
const User = require('../models/User');
const { verifyProblem } = require('../utils/codingGrader');

// The 7 CUIC C.O.D.E sheets → topic taxonomy. `pdf` is the source file under
// from_cuic/Codes/ (registered as a topic resource for reference + path tests).
const DSA_TOPICS = [
  { name: 'Arrays', description: 'Array techniques: traversal, two-pointers, prefix sums, Kadane.', pdf: 'C.O.D.E - 1 - Array.pdf' },
  { name: 'Strings', description: 'String manipulation, pattern matching, palindromes, hashing.', pdf: 'C.O.D.E - 2 - Strings.pdf' },
  { name: 'Stack and Queue', description: 'Stacks, queues, monotonic stacks, expression evaluation.', pdf: 'C.O.D.E - 3 - Stack and Queue.pdf' },
  { name: 'Heap and Recursion', description: 'Heaps / priority queues and recursive problem solving.', pdf: 'C.O.D.E - 4 - Heap and Recursion.pdf' },
  { name: 'Linked List and Binary Tree', description: 'Linked lists and binary tree traversals / properties.', pdf: 'C.O.D.E - 5 - Linked List and Binary Tree.pdf' },
  { name: 'Binary Search Trees and Greedy', description: 'BST operations and greedy algorithm design.', pdf: 'C.O.D.E - 6 - Binary Search Trees and Greedy algorithms.pdf' },
  { name: 'Dynamic Programming', description: 'DP patterns: 1D/2D, knapsack, subsequences, climbing.', pdf: 'C.O.D.E - 7 - Dynamic Programming.pdf' },
];

// Minimal per-shape starter boilerplate (a hint only — never graded). The
// reference + description define the real stdin contract.
const SHAPE = {
  intArray: {
    python: 'n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n',
    javascript: "let _i='';process.stdin.on('data',d=>_i+=d);process.stdin.on('end',()=>{\n  const L=_i.trim().split('\\n');const n=+L[0];const arr=L[1].split(' ').map(Number);\n  // Your code here\n});\n",
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;cin>>n;vector<long long>a(n);for(auto&x:a)cin>>x;\n  // Your code here\n  return 0;}\n',
    java: 'import java.util.*;\npublic class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);int n=s.nextInt();long[] x=new long[n];for(int i=0;i<n;i++)x[i]=s.nextLong();\n  // Your code here\n}}\n',
    c: '#include <stdio.h>\nint main(){int n;scanf("%d",&n);long long a[n];for(int i=0;i<n;i++)scanf("%lld",&a[i]);\n  // Your code here\n  return 0;}\n',
  },
  intArrayK: {
    python: 'n = int(input())\narr = list(map(int, input().split()))\nk = int(input())\n# Your code here\n',
    javascript: "let _i='';process.stdin.on('data',d=>_i+=d);process.stdin.on('end',()=>{\n  const L=_i.trim().split('\\n');const n=+L[0];const arr=L[1].split(' ').map(Number);const k=+L[2];\n  // Your code here\n});\n",
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;cin>>n;vector<long long>a(n);for(auto&x:a)cin>>x;int k;cin>>k;\n  // Your code here\n  return 0;}\n',
    java: 'import java.util.*;\npublic class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);int n=s.nextInt();long[] x=new long[n];for(int i=0;i<n;i++)x[i]=s.nextLong();int k=s.nextInt();\n  // Your code here\n}}\n',
    c: '#include <stdio.h>\nint main(){int n;scanf("%d",&n);long long a[n];for(int i=0;i<n;i++)scanf("%lld",&a[i]);int k;scanf("%d",&k);\n  // Your code here\n  return 0;}\n',
  },
  intArrayTarget: {
    python: 'n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# Your code here\n',
    javascript: "let _i='';process.stdin.on('data',d=>_i+=d);process.stdin.on('end',()=>{\n  const L=_i.trim().split('\\n');const arr=L[1].split(' ').map(Number);const target=+L[2];\n  // Your code here\n});\n",
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;cin>>n;vector<long long>a(n);for(auto&x:a)cin>>x;long long t;cin>>t;\n  // Your code here\n  return 0;}\n',
    java: 'import java.util.*;\npublic class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);int n=s.nextInt();long[] x=new long[n];for(int i=0;i<n;i++)x[i]=s.nextLong();long t=s.nextLong();\n  // Your code here\n}}\n',
    c: '#include <stdio.h>\nint main(){int n;scanf("%d",&n);long long a[n];for(int i=0;i<n;i++)scanf("%lld",&a[i]);long long t;scanf("%lld",&t);\n  // Your code here\n  return 0;}\n',
  },
  int: {
    python: 'n = int(input())\n# Your code here\n',
    javascript: "let _i='';process.stdin.on('data',d=>_i+=d);process.stdin.on('end',()=>{\n  const n=parseInt(_i.trim());\n  // Your code here\n});\n",
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){long long n;cin>>n;\n  // Your code here\n  return 0;}\n',
    java: 'import java.util.*;\npublic class Main{public static void main(String[] a){long n=new Scanner(System.in).nextLong();\n  // Your code here\n}}\n',
    c: '#include <stdio.h>\nint main(){long long n;scanf("%lld",&n);\n  // Your code here\n  return 0;}\n',
  },
  string: {
    python: 's = input()\n# Your code here\n',
    javascript: "let _i='';process.stdin.on('data',d=>_i+=d);process.stdin.on('end',()=>{\n  const s=_i.split('\\n')[0];\n  // Your code here\n});\n",
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){string s;getline(cin,s);\n  // Your code here\n  return 0;}\n',
    java: 'import java.util.*;\npublic class Main{public static void main(String[] a){String s=new Scanner(System.in).nextLine();\n  // Your code here\n}}\n',
    c: '#include <stdio.h>\nint main(){char s[100001];fgets(s,sizeof(s),stdin);\n  // Your code here\n  return 0;}\n',
  },
  generic: {
    python: 'lines = []\nwhile True:\n    try: lines.append(input())\n    except EOFError: break\n# Your code here\n',
    javascript: "let _i='';process.stdin.on('data',d=>_i+=d);process.stdin.on('end',()=>{\n  const lines=_i.split('\\n');\n  // Your code here\n});\n",
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){\n  // Read from cin as described.\n  return 0;}\n',
    java: 'import java.util.*;\npublic class Main{public static void main(String[] a){Scanner s=new Scanner(System.in);\n  // Read as described.\n}}\n',
    c: '#include <stdio.h>\nint main(){\n  // Read as described.\n  return 0;}\n',
  },
};

// Representative problems — 2 per topic. Each ships a Python 3 `reference`; the
// expected outputs are produced by running it (verifyProblem) — never hand-typed.
const PROBLEMS = [
  // ── Arrays ──
  {
    topicName: 'Arrays', title: 'Two Sum', difficulty: 'easy', category: 'arrays', shape: 'intArrayTarget',
    description: 'Given n integers and a target, find the two distinct 0-indexed positions whose values add up to the target (a unique solution is guaranteed).\n\nInput: line 1 = n; line 2 = n space-separated integers; line 3 = target.\nOutput: the two positions, smaller index first, space-separated.',
    examples: [{ input: '4\n2 7 11 15\n9', output: '0 1', explanation: 'arr[0]+arr[1] = 9' }],
    testInputs: ['4\n2 7 11 15\n9', '3\n3 2 4\n6', '2\n3 3\n6', '5\n1 5 3 4 2\n7', '4\n-3 4 3 90\n0'],
    reference: 'k=int(input())\narr=list(map(int,input().split()))\nt=int(input())\nseen={}\nfor i,x in enumerate(arr):\n    if t-x in seen:\n        print(seen[t-x], i); break\n    if x not in seen: seen[x]=i\n',
  },
  {
    topicName: 'Arrays', title: 'Maximum Subarray Sum', difficulty: 'medium', category: 'arrays', shape: 'intArray',
    description: "Given an array of n integers (may be negative), find the largest sum of any contiguous subarray (Kadane's algorithm).\n\nInput: line 1 = n; line 2 = n space-separated integers.\nOutput: the maximum subarray sum.",
    examples: [{ input: '9\n-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: '[4,-1,2,1] sums to 6' }],
    testInputs: ['9\n-2 1 -3 4 -1 2 1 -5 4', '1\n-5', '5\n1 2 3 4 5', '5\n-1 -2 -3 -4 -5', '6\n5 -3 5 -2 5 -1'],
    reference: 'n=int(input())\na=list(map(int,input().split()))\nbest=cur=a[0]\nfor x in a[1:]:\n    cur=max(x,cur+x); best=max(best,cur)\nprint(best)\n',
  },
  // ── Strings ──
  {
    topicName: 'Strings', title: 'Reverse a String', difficulty: 'easy', category: 'strings', shape: 'string',
    description: 'Given a string, print it reversed.\n\nInput: a single line containing the string.\nOutput: the reversed string.',
    examples: [{ input: 'hello', output: 'olleh', explanation: '' }],
    testInputs: ['hello', 'world', 'a', 'racecar', 'OpenAI'],
    reference: 's=input()\nprint(s[::-1])\n',
  },
  {
    topicName: 'Strings', title: 'Check Palindrome', difficulty: 'easy', category: 'strings', shape: 'string',
    description: 'Given a string, decide whether it is a palindrome (case-insensitive).\n\nInput: a single line containing the string.\nOutput: "YES" if it is a palindrome, otherwise "NO".',
    examples: [{ input: 'Madam', output: 'YES', explanation: '' }],
    testInputs: ['racecar', 'hello', 'Madam', 'a', 'abba'],
    reference: "s=input().lower()\nprint('YES' if s==s[::-1] else 'NO')\n",
  },
  // ── Stack and Queue ──
  {
    topicName: 'Stack and Queue', title: 'Valid Parentheses', difficulty: 'easy', category: 'stacks', shape: 'string',
    description: 'Given a string of brackets ()[]{}, decide whether they are balanced and correctly nested.\n\nInput: a single line of bracket characters.\nOutput: "YES" if valid, otherwise "NO".',
    examples: [{ input: '()[]{}', output: 'YES', explanation: '' }],
    testInputs: ['()[]{}', '([{}])', '(]', '((', '{[()]}'],
    reference: "s=input()\nm={')':'(',']':'[','}':'{'}\nst=[]\nok=True\nfor c in s:\n    if c in '([{': st.append(c)\n    elif c in m:\n        if not st or st.pop()!=m[c]: ok=False; break\nprint('YES' if ok and not st else 'NO')\n",
  },
  {
    topicName: 'Stack and Queue', title: 'Evaluate Postfix Expression', difficulty: 'medium', category: 'stacks', shape: 'generic',
    description: 'Evaluate a postfix (Reverse Polish) arithmetic expression of space-separated integer operands and the operators + - * /. Division truncates toward zero.\n\nInput: a single line — the postfix expression.\nOutput: the integer result.',
    examples: [{ input: '2 3 + 4 *', output: '20', explanation: '(2+3)*4' }],
    testInputs: ['2 3 + 4 *', '5 1 2 + 4 * + 3 -', '3 4 +', '10 2 /', '6 2 - 3 *'],
    reference: "toks=input().split()\nst=[]\nfor t in toks:\n    if t in ('+','-','*','/'):\n        b=st.pop(); a=st.pop()\n        if t=='+': st.append(a+b)\n        elif t=='-': st.append(a-b)\n        elif t=='*': st.append(a*b)\n        else: st.append(int(a/b))\n    else: st.append(int(t))\nprint(st[0])\n",
  },
  // ── Heap and Recursion ──
  {
    topicName: 'Heap and Recursion', title: 'Kth Largest Element', difficulty: 'medium', category: 'heaps', shape: 'intArrayK',
    description: 'Given an array of n integers and an integer k, print the kth largest element.\n\nInput: line 1 = n; line 2 = n integers; line 3 = k (1 <= k <= n).\nOutput: the kth largest value.',
    examples: [{ input: '6\n3 2 1 5 6 4\n2', output: '5', explanation: '2nd largest is 5' }],
    testInputs: ['6\n3 2 1 5 6 4\n2', '5\n1 2 3 4 5\n1', '5\n1 2 3 4 5\n5', '4\n7 7 7 7\n2', '3\n-1 -2 -3\n2'],
    reference: 'import heapq\nn=int(input())\na=list(map(int,input().split()))\nk=int(input())\nprint(heapq.nlargest(k,a)[-1])\n',
  },
  {
    topicName: 'Heap and Recursion', title: 'Factorial (Recursion)', difficulty: 'easy', category: 'recursion', shape: 'int',
    description: 'Compute n! (n factorial) using recursion.\n\nInput: a single integer n (0 <= n <= 20).\nOutput: the value of n!.',
    examples: [{ input: '5', output: '120', explanation: '5! = 120' }],
    testInputs: ['0', '1', '5', '10', '20'],
    reference: 'def f(n):\n    return 1 if n<=1 else n*f(n-1)\nprint(f(int(input())))\n',
  },
  // ── Linked List and Binary Tree ──
  {
    topicName: 'Linked List and Binary Tree', title: 'Reverse a Linked List', difficulty: 'easy', category: 'linked-list', shape: 'intArray',
    description: 'Given the values of a singly linked list in order, print the values after reversing the list.\n\nInput: line 1 = n; line 2 = n space-separated values (head first).\nOutput: the reversed values, space-separated.',
    examples: [{ input: '5\n1 2 3 4 5', output: '5 4 3 2 1', explanation: '' }],
    testInputs: ['5\n1 2 3 4 5', '1\n9', '2\n1 2', '4\n10 20 30 40', '3\n-1 0 1'],
    reference: 'n=int(input())\na=list(map(int,input().split()))\nprint(*a[::-1])\n',
  },
  {
    topicName: 'Linked List and Binary Tree', title: 'Maximum Depth of Binary Tree', difficulty: 'medium', category: 'trees', shape: 'generic',
    description: "Given a binary tree as a level-order array (using 'null' for missing nodes), print its maximum depth (number of nodes on the longest root-to-leaf path).\n\nInput: one line of node values in level order, space-separated, with 'null' for absent nodes.\nOutput: the maximum depth.",
    examples: [{ input: '3 9 20 null null 15 7', output: '3', explanation: '' }],
    testInputs: ['3 9 20 null null 15 7', '1', '1 2 3 null null 4 5', '1 null 2 null 3', '5 4 7'],
    reference: "from collections import deque\nvals=input().split()\ndef build(vals):\n    if not vals or vals[0] in ('null',''): return None\n    root={'l':None,'r':None}; q=deque([root]); i=1\n    while q and i<len(vals):\n        nd=q.popleft()\n        if i<len(vals):\n            if vals[i]!='null': nd['l']={'l':None,'r':None}; q.append(nd['l'])\n            i+=1\n        if i<len(vals):\n            if vals[i]!='null': nd['r']={'l':None,'r':None}; q.append(nd['r'])\n            i+=1\n    return root\ndef depth(nd):\n    if nd is None: return 0\n    return 1+max(depth(nd['l']),depth(nd['r']))\nprint(depth(build(vals)))\n",
  },
  // ── Binary Search Trees and Greedy ──
  {
    topicName: 'Binary Search Trees and Greedy', title: 'BST Insert and Inorder', difficulty: 'medium', category: 'bst', shape: 'intArray',
    description: 'Insert the given values one by one into an initially empty Binary Search Tree, then print the inorder traversal (which is the sorted order).\n\nInput: line 1 = n; line 2 = n space-separated distinct integers (insertion order).\nOutput: the inorder traversal, space-separated.',
    examples: [{ input: '5\n5 3 7 2 4', output: '2 3 4 5 7', explanation: '' }],
    testInputs: ['5\n5 3 7 2 4', '1\n10', '3\n2 1 3', '4\n4 2 6 1', '5\n50 30 70 20 40'],
    reference: 'n=int(input())\na=list(map(int,input().split()))\ndef insert(root,x):\n    if root is None: return {"v":x,"l":None,"r":None}\n    if x<root["v"]: root["l"]=insert(root["l"],x)\n    else: root["r"]=insert(root["r"],x)\n    return root\nroot=None\nfor x in a: root=insert(root,x)\nout=[]\ndef ino(nd):\n    if nd is None: return\n    ino(nd["l"]); out.append(nd["v"]); ino(nd["r"])\nino(root)\nprint(*out)\n',
  },
  {
    topicName: 'Binary Search Trees and Greedy', title: 'Minimum Coins (Greedy)', difficulty: 'easy', category: 'greedy', shape: 'int',
    description: 'Given an amount, find the minimum number of coins needed using the denominations {1,2,5,10,20,50,100,200,500,2000} (the greedy choice is optimal for this set).\n\nInput: a single integer amount (>= 0).\nOutput: the minimum number of coins.',
    examples: [{ input: '121', output: '3', explanation: '100 + 20 + 1' }],
    testInputs: ['121', '0', '70', '2000', '999'],
    reference: 'amt=int(input())\ncoins=[2000,500,200,100,50,20,10,5,2,1]\nc=0\nfor co in coins:\n    c+=amt//co; amt%=co\nprint(c)\n',
  },
  // ── Dynamic Programming ──
  {
    topicName: 'Dynamic Programming', title: 'Climbing Stairs', difficulty: 'easy', category: 'dp', shape: 'int',
    description: 'You are climbing a staircase with n steps. Each move you can climb 1 or 2 steps. Count the distinct ways to reach the top.\n\nInput: a single integer n (1 <= n <= 45).\nOutput: the number of distinct ways.',
    examples: [{ input: '3', output: '3', explanation: '1+1+1, 1+2, 2+1' }],
    testInputs: ['1', '2', '3', '5', '10'],
    reference: 'n=int(input())\nif n<=2:\n    print(n)\nelse:\n    x,y=1,2\n    for _ in range(3,n+1): x,y=y,x+y\n    print(y)\n',
  },
  {
    topicName: 'Dynamic Programming', title: '0/1 Knapsack', difficulty: 'medium', category: 'dp', shape: 'generic',
    description: 'Given n items with weights and values and a knapsack capacity W, maximize the total value without exceeding W (each item used at most once).\n\nInput: line 1 = "n W"; line 2 = n weights; line 3 = n values.\nOutput: the maximum achievable value.',
    examples: [{ input: '3 50\n10 20 30\n60 100 120', output: '220', explanation: 'items 2 and 3' }],
    testInputs: ['3 50\n10 20 30\n60 100 120', '1 1\n2\n5', '2 5\n1 2\n10 20', '3 10\n5 4 6\n10 40 30', '4 8\n1 2 3 4\n10 20 30 40'],
    reference: 'first=input().split()\nn=int(first[0]); W=int(first[1])\nwt=list(map(int,input().split()))\nval=list(map(int,input().split()))\ndp=[0]*(W+1)\nfor i in range(n):\n    for w in range(W,wt[i]-1,-1):\n        dp[w]=max(dp[w],dp[w-wt[i]]+val[i])\nprint(dp[W])\n',
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Uploader for resources (Resource.uploadedBy is required). Prefer an admin.
    const owner = await User.findOne({ role: 'admin' }) || await User.findOne({});
    if (!owner) console.warn('⚠️  No users found — coding questions seed will use createdBy=null and resources will be skipped.');

    // 1) Topics (idempotent upsert by name).
    const topicByName = {};
    for (const t of DSA_TOPICS) {
      const doc = await Topic.findOneAndUpdate(
        { name: t.name },
        { $setOnInsert: { name: t.name, description: t.description, createdBy: owner?._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      topicByName[t.name] = doc;
    }
    console.log(`✅ ${Object.keys(topicByName).length} DSA topics ensured`);

    // 2) Coding questions (reference-verified, idempotent upsert by title).
    let seeded = 0, skipped = 0;
    for (const p of PROBLEMS) {
      const { testCases, verified, reason } = await verifyProblem(p);
      if (!verified) {
        skipped++;
        console.warn(`   ⚠️  Skipped "${p.title}": ${reason || 'verification failed'}`);
        continue;
      }
      const topic = topicByName[p.topicName] || topicByName['Arrays'];
      await CodingQuestion.findOneAndUpdate(
        { title: p.title },
        {
          $set: {
            title: p.title, description: p.description, difficulty: p.difficulty,
            category: p.category, topic: topic._id, examples: p.examples,
            testCases, boilerplate: SHAPE[p.shape] || SHAPE.generic,
            referenceSolution: p.reference, verified: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      seeded++;
    }
    console.log(`✅ ${seeded} coding questions seeded (verified, gradeable)${skipped ? `, ${skipped} skipped` : ''}`);

    // 3) Practice-sheet PDFs as topic resources (idempotent; needs an uploader).
    let resCount = 0;
    if (owner) {
      for (const t of DSA_TOPICS) {
        const topic = topicByName[t.name];
        const title = `CUIC C.O.D.E — ${t.name} (practice sheet)`;
        const existing = await Resource.findOne({ title, topic: topic._id });
        if (existing) continue;
        await Resource.create({
          title,
          description: `${t.description} Source: from_cuic/Codes/${t.pdf}.`,
          topic: topic._id,
          level: 'intermediate',
          resourceType: 'pdf',
          fileName: t.pdf,
          uploadedBy: owner._id,
        });
        resCount++;
      }
      console.log(`✅ ${resCount} practice-sheet resources registered`);
    }

    console.log('\n🎯 DSA seed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
