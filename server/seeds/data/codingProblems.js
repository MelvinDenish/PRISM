// Authored coding-practice problem bank for the standalone /coding-questions tracker.
//
// Every problem is stdin/stdout (so it can be graded by executeCode against
// hidden test cases) and ships a Python 3 `reference` solution. Expected outputs
// are NOT stored here — they are generated at seed time by running the reference
// (see utils/codingGrader.verifyProblem), which is the A7-safe guarantee: a user
// is never graded against a hand-typed answer key.
//
// `shape` selects starter boilerplate from BOILERPLATE below; the reference and
// the description define the real stdin contract. Boilerplate is only a hint and
// is never graded.

// ── Starter boilerplate by input shape ───────────────────────────────────────
// NOTE: the code sandbox blocks `import sys`/`os` (Python) and `require('fs')`
// (JS), so stdin is read with input() loops / process.stdin, never sys.stdin/fs.
const GENERIC = {
    python: `lines = []\nwhile True:\n    try: lines.append(input())\n    except EOFError: break\n# Parse the lines as described in the problem, then print your answer.\n`,
    javascript: `let _input = '';\nprocess.stdin.on('data', (d) => { _input += d; });\nprocess.stdin.on('end', () => {\n    const data = _input.split('\\n');\n    // Parse the input as described, then console.log your answer.\n});\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    // Read from cin as described, then print your answer.\n    return 0;\n}\n`,
    java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Read as described, then print your answer.\n    }\n}\n`,
    c: `#include <stdio.h>\nint main() {\n    // Read as described, then print your answer.\n    return 0;\n}\n`,
};

const BOILERPLATE = {
    int: {
        python: `n = int(input())\n# Your code here\n`,
        javascript: `let _i = '';\nprocess.stdin.on('data', (d) => { _i += d; });\nprocess.stdin.on('end', () => {\n    const n = parseInt(_i.trim());\n    // Your code here\n});\n`,
        cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    long long n; cin >> n;\n    // Your code here\n    return 0;\n}\n`,
        java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        long n = sc.nextLong();\n        // Your code here\n    }\n}\n`,
        c: `#include <stdio.h>\nint main() {\n    long long n; scanf("%lld", &n);\n    // Your code here\n    return 0;\n}\n`,
    },
    intArray: {
        python: `n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n`,
        javascript: `let _i = '';\nprocess.stdin.on('data', (d) => { _i += d; });\nprocess.stdin.on('end', () => {\n    const lines = _i.trim().split('\\n');\n    const n = parseInt(lines[0]);\n    const arr = lines[1].split(' ').map(Number);\n    // Your code here\n});\n`,
        cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<long long> arr(n);\n    for (int i = 0; i < n; i++) cin >> arr[i];\n    // Your code here\n    return 0;\n}\n`,
        java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        long[] arr = new long[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextLong();\n        // Your code here\n    }\n}\n`,
        c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    long long arr[n];\n    for (int i = 0; i < n; i++) scanf("%lld", &arr[i]);\n    // Your code here\n    return 0;\n}\n`,
    },
    intArrayTarget: {
        python: `n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# Your code here\n`,
        javascript: `let _i = '';\nprocess.stdin.on('data', (d) => { _i += d; });\nprocess.stdin.on('end', () => {\n    const lines = _i.trim().split('\\n');\n    const n = parseInt(lines[0]);\n    const arr = lines[1].split(' ').map(Number);\n    const target = parseInt(lines[2]);\n    // Your code here\n});\n`,
        cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<long long> arr(n);\n    for (int i = 0; i < n; i++) cin >> arr[i];\n    long long target; cin >> target;\n    // Your code here\n    return 0;\n}\n`,
        java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        long[] arr = new long[n];\n        for (int i = 0; i < n; i++) arr[i] = sc.nextLong();\n        long target = sc.nextLong();\n        // Your code here\n    }\n}\n`,
        c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    long long arr[n];\n    for (int i = 0; i < n; i++) scanf("%lld", &arr[i]);\n    long long target; scanf("%lld", &target);\n    // Your code here\n    return 0;\n}\n`,
    },
    string: {
        python: `s = input()\n# Your code here\n`,
        javascript: `let _i = '';\nprocess.stdin.on('data', (d) => { _i += d; });\nprocess.stdin.on('end', () => {\n    const s = _i.split('\\n')[0];\n    // Your code here\n});\n`,
        cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    string s; getline(cin, s);\n    // Your code here\n    return 0;\n}\n`,
        java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.nextLine();\n        // Your code here\n    }\n}\n`,
        c: `#include <stdio.h>\nint main() {\n    char s[100001];\n    fgets(s, sizeof(s), stdin);\n    // Your code here\n    return 0;\n}\n`,
    },
};

const boilerplateFor = (shape) => BOILERPLATE[shape] || GENERIC;

// ── Problems ──────────────────────────────────────────────────────────────────
// topicName maps to a seeded Topic by name (best-effort; falls back in the seed).
const RAW = [
    {
        title: 'Two Sum', difficulty: 'easy', category: 'arrays', topicName: 'Data Structures', shape: 'intArrayTarget',
        description: 'Given n integers and a target, find the two distinct positions whose values add up to the target (a unique solution is guaranteed).\n\nInput: line 1 = n; line 2 = n space-separated integers; line 3 = target.\nOutput: the two 0-indexed positions, smaller index first, space-separated.',
        examples: [{ input: '4\n2 7 11 15\n9', output: '0 1', explanation: 'arr[0]+arr[1] = 2+7 = 9' }],
        testInputs: ['4\n2 7 11 15\n9', '3\n3 2 4\n6', '2\n3 3\n6', '5\n1 2 3 4 5\n9', '4\n-3 4 3 90\n0'],
        reference: `k=int(input())\narr=list(map(int,input().split()))\nt=int(input())\nseen={}\nfor i,x in enumerate(arr):\n    if t-x in seen:\n        print(seen[t-x], i); break\n    if x not in seen: seen[x]=i\n`,
    },
    {
        title: 'Reverse a String', difficulty: 'easy', category: 'strings', topicName: 'String Algorithms', shape: 'string',
        description: 'Given a string, print it reversed.\n\nInput: a single line containing the string.\nOutput: the reversed string.',
        examples: [{ input: 'hello', output: 'olleh', explanation: '' }],
        testInputs: ['hello', 'world', 'a', 'racecar', 'OpenAI'],
        reference: `s=input()\nprint(s[::-1])\n`,
    },
    {
        title: 'Maximum Subarray Sum', difficulty: 'medium', category: 'arrays', topicName: 'Dynamic Programming', shape: 'intArray',
        description: "Given an array of n integers (which may be negative), find the largest sum of any contiguous non-empty subarray (Kadane's algorithm).\n\nInput: line 1 = n; line 2 = n space-separated integers.\nOutput: the maximum subarray sum.",
        examples: [{ input: '8\n-2 1 -3 4 -1 2 1 -5', output: '6', explanation: 'Subarray [4,-1,2,1] sums to 6' }],
        testInputs: ['8\n-2 1 -3 4 -1 2 1 -5', '1\n-1', '5\n1 2 3 4 5', '5\n-1 -2 -3 -4 -5', '6\n5 -3 5 -2 5 -1'],
        reference: `n=int(input())\narr=list(map(int,input().split()))\nbest=cur=arr[0]\nfor x in arr[1:]:\n    cur=max(x,cur+x); best=max(best,cur)\nprint(best)\n`,
    },
    {
        title: 'Fibonacci Number', difficulty: 'easy', category: 'recursion', topicName: 'Recursion & Backtracking', shape: 'int',
        description: 'Print the nth Fibonacci number (0-indexed). F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2).\n\nInput: a single integer n (0 ≤ n ≤ 50).\nOutput: F(n).',
        examples: [{ input: '6', output: '8', explanation: '0,1,1,2,3,5,8' }],
        testInputs: ['0', '1', '6', '10', '20'],
        reference: `n=int(input())\na,b=0,1\nfor _ in range(n): a,b=b,a+b\nprint(a)\n`,
    },
    {
        title: 'Check Palindrome', difficulty: 'easy', category: 'strings', topicName: 'String Algorithms', shape: 'string',
        description: 'Determine whether a string reads the same forwards and backwards.\n\nInput: a single line containing the string.\nOutput: "true" or "false".',
        examples: [{ input: 'racecar', output: 'true', explanation: '' }],
        testInputs: ['racecar', 'hello', 'a', 'abba', 'abc'],
        reference: `s=input()\nprint(str(s==s[::-1]).lower())\n`,
    },
    {
        title: 'Merge Two Sorted Arrays', difficulty: 'medium', category: 'arrays', topicName: 'Data Structures', shape: 'generic',
        description: 'Merge two sorted integer arrays into one sorted array.\n\nInput: line 1 = n; line 2 = n integers (sorted); line 3 = m; line 4 = m integers (sorted).\nOutput: all n+m integers in sorted order, space-separated on one line.',
        examples: [{ input: '3\n1 3 5\n3\n2 4 6', output: '1 2 3 4 5 6', explanation: '' }],
        testInputs: ['3\n1 3 5\n3\n2 4 6', '2\n1 2\n3\n3 4 5', '1\n5\n1\n1', '3\n1 1 1\n2\n1 1', '4\n2 4 6 8\n3\n1 3 5'],
        reference: `n=int(input())\na=list(map(int,input().split()))\nm=int(input())\nb=list(map(int,input().split()))\nprint(*sorted(a+b))\n`,
    },
    {
        title: 'Count Vowels in String', difficulty: 'easy', category: 'strings', topicName: 'String Algorithms', shape: 'string',
        description: 'Count the vowels (a, e, i, o, u — case-insensitive) in a string.\n\nInput: a single line containing the string.\nOutput: the number of vowels.',
        examples: [{ input: 'hello', output: '2', explanation: '' }],
        testInputs: ['hello', 'PROGRAMMING', 'xyz', 'AEIOU', 'Education'],
        reference: `s=input()\nprint(sum(c in 'aeiouAEIOU' for c in s))\n`,
    },
    {
        title: 'Binary Search', difficulty: 'easy', category: 'searching', topicName: 'Data Structures', shape: 'intArrayTarget',
        description: 'Given a sorted array, return the index of the target value, or -1 if it is absent.\n\nInput: line 1 = n; line 2 = n sorted integers; line 3 = target.\nOutput: the 0-indexed position of target, or -1.',
        examples: [{ input: '5\n1 2 3 4 5\n3', output: '2', explanation: '' }],
        testInputs: ['5\n1 2 3 4 5\n3', '5\n1 2 3 4 5\n6', '1\n7\n7', '6\n2 4 6 8 10 12\n10', '4\n1 3 5 7\n2'],
        reference: `n=int(input())\narr=list(map(int,input().split()))\nt=int(input())\nlo,hi=0,n-1; ans=-1\nwhile lo<=hi:\n    mid=(lo+hi)//2\n    if arr[mid]==t: ans=mid; break\n    elif arr[mid]<t: lo=mid+1\n    else: hi=mid-1\nprint(ans)\n`,
    },
    {
        title: 'Longest Common Prefix', difficulty: 'medium', category: 'strings', topicName: 'String Algorithms', shape: 'generic',
        description: 'Find the longest common prefix string among an array of strings.\n\nInput: line 1 = k; next k lines each a string.\nOutput: the longest common prefix (print an empty line if there is none).',
        examples: [{ input: '3\nflower\nflow\nflight', output: 'fl', explanation: '' }],
        testInputs: ['3\nflower\nflow\nflight', '3\ndog\nracecar\ncar', '1\nalone', '2\nabc\nabcd', '3\ninter\ninternet\ninternal'],
        reference: `k=int(input())\nws=[input() for _ in range(k)]\npre=ws[0]\nfor w in ws[1:]:\n    while not w.startswith(pre): pre=pre[:-1]\nprint(pre)\n`,
    },
    {
        title: 'Climbing Stairs', difficulty: 'medium', category: 'dp', topicName: 'Dynamic Programming', shape: 'int',
        description: 'You climb a staircase of n steps, taking 1 or 2 steps at a time. Count the distinct ways to reach the top.\n\nInput: a single integer n (1 ≤ n ≤ 45).\nOutput: the number of distinct ways.',
        examples: [{ input: '3', output: '3', explanation: '1+1+1, 1+2, 2+1' }],
        testInputs: ['1', '2', '3', '5', '10'],
        reference: `n=int(input())\na,b=1,1\nfor _ in range(n): a,b=b,a+b\nprint(a)\n`,
    },
    {
        title: 'Valid Parentheses', difficulty: 'easy', category: 'stacks', topicName: 'Data Structures', shape: 'string',
        description: "Given a string of brackets '()[]{}', determine whether it is validly nested and matched.\n\nInput: a single line containing the bracket string.\nOutput: \"true\" or \"false\".",
        examples: [{ input: '([])', output: 'true', explanation: '' }],
        testInputs: ['()', '([])', '([)]', '(((', '{[]}'],
        reference: `s=input()\nst=[]; m={')':'(',']':'[','}':'{'}; ok=True\nfor c in s:\n    if c in '([{': st.append(c)\n    elif c in m:\n        if not st or st.pop()!=m[c]: ok=False; break\nprint(str(ok and not st).lower())\n`,
    },
    {
        title: 'Best Time to Buy and Sell Stock', difficulty: 'easy', category: 'arrays', topicName: 'Dynamic Programming', shape: 'intArray',
        description: 'Given daily prices, find the maximum profit from buying on one day and selling on a later day. If no profit is possible, output 0.\n\nInput: line 1 = n; line 2 = n prices.\nOutput: the maximum profit.',
        examples: [{ input: '6\n7 1 5 3 6 4', output: '5', explanation: 'Buy at 1, sell at 6' }],
        testInputs: ['6\n7 1 5 3 6 4', '5\n7 6 4 3 1', '1\n5', '4\n2 4 1 8', '5\n3 2 6 5 0'],
        reference: `n=int(input())\na=list(map(int,input().split()))\nmn=a[0]; best=0\nfor x in a:\n    mn=min(mn,x); best=max(best,x-mn)\nprint(best)\n`,
    },
    {
        title: 'Trapping Rain Water', difficulty: 'hard', category: 'arrays', topicName: 'Data Structures', shape: 'intArray',
        description: 'Given an elevation map of n bars (each width 1), compute how much water it traps after raining.\n\nInput: line 1 = n; line 2 = n non-negative heights.\nOutput: total trapped water.',
        examples: [{ input: '12\n0 1 0 2 1 0 1 3 2 1 2 1', output: '6', explanation: '' }],
        testInputs: ['12\n0 1 0 2 1 0 1 3 2 1 2 1', '6\n4 2 0 3 2 5', '3\n1 2 3', '5\n5 4 3 2 1', '5\n3 0 2 0 4'],
        reference: `n=int(input())\nh=list(map(int,input().split()))\nl,r=0,n-1; lm=rm=0; res=0\nwhile l<r:\n    if h[l]<h[r]:\n        lm=max(lm,h[l]); res+=lm-h[l]; l+=1\n    else:\n        rm=max(rm,h[r]); res+=rm-h[r]; r-=1\nprint(res)\n`,
    },
    {
        title: 'Longest Substring Without Repeating Characters', difficulty: 'medium', category: 'strings', topicName: 'String Algorithms', shape: 'string',
        description: 'Find the length of the longest substring of s without repeating characters.\n\nInput: a single line containing s.\nOutput: the length of the longest such substring.',
        examples: [{ input: 'abcabcbb', output: '3', explanation: '"abc"' }],
        testInputs: ['abcabcbb', 'bbbbb', 'pwwkew', 'abcdef', 'dvdf'],
        reference: `s=input()\nseen={}; start=0; best=0\nfor i,c in enumerate(s):\n    if c in seen and seen[c]>=start: start=seen[c]+1\n    seen[c]=i; best=max(best,i-start+1)\nprint(best)\n`,
    },
    {
        title: 'Coin Change', difficulty: 'medium', category: 'dp', topicName: 'Dynamic Programming', shape: 'intArrayTarget',
        description: 'Given coin denominations and an amount, return the fewest coins needed to make the amount, or -1 if it cannot be made.\n\nInput: line 1 = k (number of coins); line 2 = k denominations; line 3 = amount.\nOutput: the minimum number of coins, or -1.',
        examples: [{ input: '3\n1 2 5\n11', output: '3', explanation: '5+5+1' }],
        testInputs: ['3\n1 2 5\n11', '1\n2\n3', '1\n1\n0', '4\n2 5 10 1\n27', '2\n3 7\n12'],
        reference: `k=int(input())\ncoins=list(map(int,input().split()))\namt=int(input())\nINF=float('inf')\ndp=[0]+[INF]*amt\nfor i in range(1,amt+1):\n    for c in coins:\n        if c<=i: dp[i]=min(dp[i],dp[i-c]+1)\nprint(dp[amt] if dp[amt]!=INF else -1)\n`,
    },
    {
        title: 'Word Break', difficulty: 'medium', category: 'dp', topicName: 'Dynamic Programming', shape: 'generic',
        description: 'Given a string s and a dictionary of words, determine whether s can be segmented into a space-separated sequence of dictionary words.\n\nInput: line 1 = s; line 2 = the dictionary words, space-separated.\nOutput: "true" or "false".',
        examples: [{ input: 'leetcode\nleet code', output: 'true', explanation: '' }],
        testInputs: ['leetcode\nleet code', 'applepenapple\napple pen', 'catsandog\ncats dog sand and', 'a\na', 'abcd\na abc b cd'],
        reference: `s=input()\nwords=set(input().split())\nn=len(s); dp=[True]+[False]*n\nfor i in range(1,n+1):\n    for j in range(i):\n        if dp[j] and s[j:i] in words: dp[i]=True; break\nprint(str(dp[n]).lower())\n`,
    },
    {
        title: 'Number of Islands', difficulty: 'medium', category: 'graphs', topicName: 'Graph Theory', shape: 'generic',
        description: "Given a grid of '1' (land) and '0' (water), count the islands (groups of land connected horizontally or vertically).\n\nInput: line 1 = R C; next R lines each have C space-separated values (0 or 1).\nOutput: the number of islands.",
        examples: [{ input: '3 3\n1 1 0\n1 1 0\n0 0 1', output: '2', explanation: '' }],
        testInputs: ['3 3\n1 1 0\n1 1 0\n0 0 1', '1 1\n0', '1 1\n1', '3 3\n1 0 1\n0 1 0\n1 0 1', '2 4\n1 1 0 0\n0 0 1 1'],
        reference: `R,C=map(int,input().split())\ng=[input().split() for _ in range(R)]\nseen=[[False]*C for _ in range(R)]\ndef dfs(r,c):\n    st=[(r,c)]\n    while st:\n        x,y=st.pop()\n        if 0<=x<R and 0<=y<C and not seen[x][y] and g[x][y]=='1':\n            seen[x][y]=True\n            st+=[(x+1,y),(x-1,y),(x,y+1),(x,y-1)]\ncnt=0\nfor i in range(R):\n    for j in range(C):\n        if g[i][j]=='1' and not seen[i][j]:\n            cnt+=1; dfs(i,j)\nprint(cnt)\n`,
    },
    {
        title: 'Course Schedule', difficulty: 'medium', category: 'graphs', topicName: 'Graph Theory', shape: 'generic',
        description: 'There are n courses (0..n-1) with prerequisite pairs "a b" meaning b must be taken before a. Determine whether all courses can be finished (no cycle).\n\nInput: line 1 = n m (courses, number of prerequisites); next m lines each "a b".\nOutput: "true" or "false".',
        examples: [{ input: '2 1\n1 0', output: 'true', explanation: '' }],
        testInputs: ['2 1\n1 0', '2 2\n1 0\n0 1', '3 2\n1 0\n2 1', '4 4\n1 0\n2 1\n3 2\n0 3', '1 0'],
        reference: `from collections import deque\nn,m=map(int,input().split())\nadj=[[] for _ in range(n)]; indeg=[0]*n\nfor _ in range(m):\n    a,b=map(int,input().split())\n    adj[b].append(a); indeg[a]+=1\nq=deque(i for i in range(n) if indeg[i]==0); cnt=0\nwhile q:\n    u=q.popleft(); cnt+=1\n    for v in adj[u]:\n        indeg[v]-=1\n        if indeg[v]==0: q.append(v)\nprint(str(cnt==n).lower())\n`,
    },
    {
        title: 'Longest Increasing Subsequence', difficulty: 'medium', category: 'dp', topicName: 'Dynamic Programming', shape: 'intArray',
        description: 'Find the length of the longest strictly increasing subsequence of an array.\n\nInput: line 1 = n; line 2 = n integers.\nOutput: the length of the LIS.',
        examples: [{ input: '8\n10 9 2 5 3 7 101 18', output: '4', explanation: '[2,3,7,101]' }],
        testInputs: ['8\n10 9 2 5 3 7 101 18', '1\n7', '5\n5 4 3 2 1', '6\n1 2 3 4 5 6', '7\n0 1 0 3 2 3'],
        reference: `import bisect\nn=int(input())\na=list(map(int,input().split()))\ntails=[]\nfor x in a:\n    i=bisect.bisect_left(tails,x)\n    if i==len(tails): tails.append(x)\n    else: tails[i]=x\nprint(len(tails))\n`,
    },
    {
        title: '3Sum (Count Triplets)', difficulty: 'medium', category: 'arrays', topicName: 'Data Structures', shape: 'intArray',
        description: 'Given an array, count the number of unique triplets (by value) that sum to zero.\n\nInput: line 1 = n; line 2 = n integers.\nOutput: the count of unique zero-sum triplets.',
        examples: [{ input: '6\n-1 0 1 2 -1 -4', output: '2', explanation: '[-1,-1,2] and [-1,0,1]' }],
        testInputs: ['6\n-1 0 1 2 -1 -4', '3\n0 0 0', '3\n1 2 3', '6\n-2 0 1 1 2 -1', '4\n0 0 0 0'],
        reference: `n=int(input())\na=sorted(map(int,input().split()))\nres=set()\nfor i in range(n):\n    l,r=i+1,n-1\n    while l<r:\n        s=a[i]+a[l]+a[r]\n        if s==0: res.add((a[i],a[l],a[r])); l+=1; r-=1\n        elif s<0: l+=1\n        else: r-=1\nprint(len(res))\n`,
    },
    {
        title: 'Merge Intervals', difficulty: 'medium', category: 'sorting', topicName: 'Data Structures', shape: 'generic',
        description: 'Merge all overlapping intervals.\n\nInput: line 1 = m; next m lines each "start end".\nOutput: the merged intervals, sorted by start, one per line as "start end".',
        examples: [{ input: '4\n1 3\n2 6\n8 10\n15 18', output: '1 6\n8 10\n15 18', explanation: '' }],
        testInputs: ['4\n1 3\n2 6\n8 10\n15 18', '2\n1 4\n4 5', '1\n5 7', '3\n1 4\n0 4\n3 5', '3\n1 2\n3 4\n5 6'],
        reference: `m=int(input())\niv=sorted([tuple(map(int,input().split())) for _ in range(m)])\nres=[]\nfor a,b in iv:\n    if res and a<=res[-1][1]: res[-1][1]=max(res[-1][1],b)\n    else: res.append([a,b])\nfor a,b in res: print(a,b)\n`,
    },
    {
        title: 'Rotate Image', difficulty: 'medium', category: 'matrix', topicName: 'Data Structures', shape: 'generic',
        description: 'Rotate an n x n integer matrix 90 degrees clockwise.\n\nInput: line 1 = n; next n lines each have n space-separated integers.\nOutput: the rotated matrix, n lines of n space-separated integers.',
        examples: [{ input: '3\n1 2 3\n4 5 6\n7 8 9', output: '7 4 1\n8 5 2\n9 6 3', explanation: '' }],
        testInputs: ['3\n1 2 3\n4 5 6\n7 8 9', '2\n1 2\n3 4', '1\n5', '3\n1 1 1\n2 2 2\n3 3 3', '2\n0 1\n2 3'],
        reference: `n=int(input())\ng=[list(map(int,input().split())) for _ in range(n)]\nrot=[[g[n-1-j][i] for j in range(n)] for i in range(n)]\nfor row in rot: print(*row)\n`,
    },
    {
        title: 'Reverse Linked List', difficulty: 'easy', category: 'linked-list', topicName: 'Data Structures', shape: 'intArray',
        description: 'Given the values of a singly linked list in order, print them reversed.\n\nInput: line 1 = n; line 2 = n node values in list order.\nOutput: the values in reverse order, space-separated.',
        examples: [{ input: '5\n1 2 3 4 5', output: '5 4 3 2 1', explanation: '' }],
        testInputs: ['5\n1 2 3 4 5', '1\n1', '2\n1 2', '3\n7 8 9', '4\n10 20 30 40'],
        reference: `n=int(input())\na=list(map(int,input().split()))\nprint(*a[::-1])\n`,
    },
    {
        title: 'LRU Cache', difficulty: 'hard', category: 'design', topicName: 'Data Structures', shape: 'generic',
        description: 'Implement a Least-Recently-Used cache of a given capacity. Process a sequence of operations: "put k v" stores a value; "get k" returns the value or -1 if absent. Both put and get count as recent use; on overflow the least recently used key is evicted.\n\nInput: line 1 = capacity numOps; next numOps lines each "put k v" or "get k".\nOutput: the result of each "get", one per line.',
        examples: [{ input: '2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nget 3', output: '1\n-1\n3', explanation: 'put 3 evicts key 2' }],
        testInputs: ['2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nget 3', '1 3\nput 1 10\nget 1\nget 2', '2 4\nput 1 1\nput 1 2\nget 1\nget 1', '2 5\nput 1 1\nput 2 2\nput 3 3\nget 1\nget 3', '1 2\nput 5 5\nget 5'],
        reference: `from collections import OrderedDict\ncap,ops=map(int,input().split())\ncache=OrderedDict(); out=[]\nfor _ in range(ops):\n    parts=input().split()\n    if parts[0]=='put':\n        k,v=int(parts[1]),int(parts[2])\n        if k in cache: cache.move_to_end(k)\n        cache[k]=v\n        if len(cache)>cap: cache.popitem(last=False)\n    else:\n        k=int(parts[1])\n        if k in cache:\n            cache.move_to_end(k); out.append(str(cache[k]))\n        else: out.append('-1')\nprint('\\n'.join(out))\n`,
    },
    {
        title: 'Implement Trie (Prefix Tree)', difficulty: 'medium', category: 'design', topicName: 'String Algorithms', shape: 'generic',
        description: 'Implement a trie supporting insert and lookup. Process operations: "insert w" adds a word; "search w" prints whether the exact word was inserted; "startsWith p" prints whether any inserted word has prefix p.\n\nInput: line 1 = numOps; next numOps lines each "insert w" / "search w" / "startsWith p".\nOutput: "true" or "false" for each search and startsWith, one per line.',
        examples: [{ input: '5\ninsert apple\nsearch apple\nsearch app\nstartsWith app\ninsert app', output: 'true\nfalse\ntrue', explanation: '' }],
        testInputs: ['5\ninsert apple\nsearch apple\nsearch app\nstartsWith app\ninsert app', '3\ninsert a\nsearch a\nstartsWith b', '4\ninsert hello\nstartsWith hel\nsearch hell\nsearch hello', '2\nsearch x\nstartsWith y', '3\ninsert cat\ninsert car\nstartsWith ca'],
        reference: `ops=int(input()); words=set(); out=[]\nfor _ in range(ops):\n    parts=input().split()\n    cmd=parts[0]; arg=parts[1] if len(parts)>1 else ''\n    if cmd=='insert': words.add(arg)\n    elif cmd=='search': out.append(str(arg in words).lower())\n    else: out.append(str(any(w.startswith(arg) for w in words)).lower())\nprint('\\n'.join(out))\n`,
    },
    {
        title: 'Binary Tree Level Order Traversal', difficulty: 'medium', category: 'trees', topicName: 'Binary Trees & BST', shape: 'generic',
        description: "Given a binary tree as a level-order array (using 'null' for missing nodes), print its level-order traversal.\n\nInput: one line of node values in level order, space-separated, with 'null' for absent nodes.\nOutput: one line per tree level, the values on that level space-separated.",
        examples: [{ input: '3 9 20 null null 15 7', output: '3\n9 20\n15 7', explanation: '' }],
        testInputs: ['3 9 20 null null 15 7', '1', '1 2 3 4 5', '1 null 2 null 3', '5 4 8 11 null 13 4'],
        reference: `from collections import deque\nvals=input().split()\nclass N:\n    def __init__(s,v): s.v=v; s.l=None; s.r=None\ndef build(vals):\n    if not vals or vals[0] in ('null',''): return None\n    root=N(vals[0]); q=deque([root]); i=1\n    while q and i<len(vals):\n        nd=q.popleft()\n        if i<len(vals):\n            if vals[i]!='null': nd.l=N(vals[i]); q.append(nd.l)\n            i+=1\n        if i<len(vals):\n            if vals[i]!='null': nd.r=N(vals[i]); q.append(nd.r)\n            i+=1\n    return root\nroot=build(vals)\nres=[]\nif root:\n    bfs=deque([root])\n    while bfs:\n        level=[]\n        for _ in range(len(bfs)):\n            nd=bfs.popleft(); level.append(nd.v)\n            if nd.l: bfs.append(nd.l)\n            if nd.r: bfs.append(nd.r)\n        res.append(' '.join(level))\nprint('\\n'.join(res))\n`,
    },
    {
        title: 'Median of Two Sorted Arrays', difficulty: 'hard', category: 'searching', topicName: 'Sorting & Searching', shape: 'generic',
        description: 'Given two sorted integer arrays, find the median of all the elements combined.\n\nInput: line 1 = n; line 2 = n sorted integers; line 3 = m; line 4 = m sorted integers.\nOutput: the median, printed with exactly one decimal place.',
        examples: [{ input: '2\n1 3\n1\n2', output: '2.0', explanation: 'Merged = [1,2,3], median 2' }],
        testInputs: ['2\n1 3\n1\n2', '2\n1 2\n2\n3 4', '1\n5\n1\n5', '3\n1 2 3\n3\n4 5 6', '1\n1\n3\n2 3 4'],
        reference: `n=int(input())\na=list(map(int,input().split()))\nm=int(input())\nb=list(map(int,input().split()))\nmerged=sorted(a+b)\nL=len(merged)\nif L%2: med=merged[L//2]\nelse: med=(merged[L//2-1]+merged[L//2])/2\nprint(f"{med:.1f}")\n`,
    },
    {
        title: 'N-Queens (Count Solutions)', difficulty: 'hard', category: 'backtracking', topicName: 'Recursion & Backtracking', shape: 'int',
        description: 'Count the number of distinct ways to place n non-attacking queens on an n x n chessboard.\n\nInput: a single integer n (1 ≤ n ≤ 9).\nOutput: the number of distinct solutions.',
        examples: [{ input: '4', output: '2', explanation: '' }],
        testInputs: ['1', '4', '5', '6', '8'],
        reference: `n=int(input())\ncols=set(); d1=set(); d2=set()\ncnt=0\ndef bt(r):\n    global cnt\n    if r==n: cnt+=1; return\n    for c in range(n):\n        if c in cols or (r-c) in d1 or (r+c) in d2: continue\n        cols.add(c); d1.add(r-c); d2.add(r+c)\n        bt(r+1)\n        cols.discard(c); d1.discard(r-c); d2.discard(r+c)\nbt(0)\nprint(cnt)\n`,
    },
    {
        title: 'Find Median from Data Stream', difficulty: 'hard', category: 'design', topicName: 'Heap & Priority Queue', shape: 'generic',
        description: 'Support a stream of integers with two operations: "add x" inserts a number; "median" reports the median of all numbers seen so far.\n\nInput: line 1 = numOps; next numOps lines each "add x" or "median".\nOutput: for each "median" operation, the current median printed with exactly one decimal place, one per line.',
        examples: [{ input: '3\nadd 1\nadd 2\nmedian', output: '1.5', explanation: '' }],
        testInputs: ['3\nadd 1\nadd 2\nmedian', '5\nadd 1\nadd 2\nadd 3\nmedian\nadd 4', '4\nadd 5\nmedian\nadd 15\nmedian', '3\nadd 2\nadd 2\nmedian', '6\nadd 6\nadd 10\nadd 2\nmedian\nadd 5\nmedian'],
        reference: `import bisect\nops=int(input()); arr=[]; out=[]\nfor _ in range(ops):\n    parts=input().split()\n    if parts[0]=='add':\n        bisect.insort(arr,int(parts[1]))\n    else:\n        L=len(arr)\n        if L%2: med=arr[L//2]\n        else: med=(arr[L//2-1]+arr[L//2])/2\n        out.append(f"{med:.1f}")\nprint('\\n'.join(out))\n`,
    },
    {
        title: 'Word Ladder', difficulty: 'hard', category: 'graphs', topicName: 'Graph Theory', shape: 'generic',
        description: 'Transform beginWord into endWord by changing one letter at a time, where every intermediate word must be in the word list. Find the length of the shortest such sequence (counting both endpoints), or 0 if impossible.\n\nInput: line 1 = "beginWord endWord"; line 2 = k (word-list size); next k lines each a word.\nOutput: the length of the shortest transformation sequence, or 0.',
        examples: [{ input: 'hit cog\n6\nhot\ndot\ndog\nlot\nlog\ncog', output: '5', explanation: 'hit→hot→dot→dog→cog' }],
        testInputs: ['hit cog\n6\nhot\ndot\ndog\nlot\nlog\ncog', 'hit cog\n5\nhot\ndot\ndog\nlot\nlog', 'a c\n3\na\nb\nc', 'hot dog\n3\nhot\ndot\ndog', 'red tax\n5\nted\ntex\ntax\nred\ntad'],
        reference: `from collections import deque\nfirst=input().split()\nbegin,end=first[0],first[1]\nk=int(input())\nwords=set(input() for _ in range(k))\nif end not in words:\n    print(0)\nelse:\n    q=deque([(begin,1)]); seen={begin}; ans=0\n    while q:\n        w,d=q.popleft()\n        if w==end: ans=d; break\n        for i in range(len(w)):\n            for c in 'abcdefghijklmnopqrstuvwxyz':\n                nw=w[:i]+c+w[i+1:]\n                if nw in words and nw not in seen:\n                    seen.add(nw); q.append((nw,d+1))\n    print(ans)\n`,
    },
    {
        title: 'Serialize and Deserialize Binary Tree', difficulty: 'hard', category: 'trees', topicName: 'Binary Trees & BST', shape: 'generic',
        description: "Reconstruct a binary tree from its level-order array (using 'null' for missing nodes), then output its preorder serialization with 'null' markers for every absent child.\n\nInput: one line of node values in level order, space-separated, with 'null' for absent nodes.\nOutput: the preorder serialization, space-separated, with 'null' for each absent child.",
        examples: [{ input: '1 2 3', output: '1 2 null null 3 null null', explanation: '' }],
        testInputs: ['1 2 3', '1 2 3 null null 4 5', '1', '5 4 7', '1 null 2 null 3'],
        reference: `from collections import deque\nvals=input().split()\nclass N:\n    def __init__(s,v): s.v=v; s.l=None; s.r=None\ndef build(vals):\n    if not vals or vals[0] in ('null',''): return None\n    root=N(vals[0]); q=deque([root]); i=1\n    while q and i<len(vals):\n        nd=q.popleft()\n        if i<len(vals):\n            if vals[i]!='null': nd.l=N(vals[i]); q.append(nd.l)\n            i+=1\n        if i<len(vals):\n            if vals[i]!='null': nd.r=N(vals[i]); q.append(nd.r)\n            i+=1\n    return root\nout=[]\ndef pre(nd):\n    if nd is None: out.append('null'); return\n    out.append(nd.v); pre(nd.l); pre(nd.r)\npre(build(vals))\nprint(' '.join(out))\n`,
    },
    {
        title: 'Regular Expression Matching', difficulty: 'hard', category: 'dp', topicName: 'Dynamic Programming', shape: 'generic',
        description: "Implement regular-expression matching with support for '.' (matches any single character) and '*' (matches zero or more of the preceding element). The match must cover the ENTIRE input string.\n\nInput: line 1 = the string s; line 2 = the pattern p.\nOutput: \"true\" or \"false\".",
        examples: [{ input: 'aa\na*', output: 'true', explanation: "'a*' matches 'aa'" }],
        testInputs: ['aa\na', 'aa\na*', 'ab\n.*', 'aab\nc*a*b', 'mississippi\nmis*is*p*.'],
        reference: `import functools\ns=input(); p=input()\n@functools.lru_cache(None)\ndef dp(i,j):\n    if j==len(p): return i==len(s)\n    first = i<len(s) and (p[j]==s[i] or p[j]=='.')\n    if j+1<len(p) and p[j+1]=='*':\n        return dp(i,j+2) or (first and dp(i+1,j))\n    return first and dp(i+1,j+1)\nprint(str(dp(0,0)).lower())\n`,
    },
];

module.exports = RAW.map((p) => ({ ...p, boilerplate: boilerplateFor(p.shape) }));
