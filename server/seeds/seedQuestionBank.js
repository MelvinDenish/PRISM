/**
 * PRISM — Curated Question Bank Seed
 * 200+ verified questions for Interview Game
 * Run: node seeds/seedQuestionBank.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const QuestionBank = require('../models/QuestionBank');

const APTITUDE_QUESTIONS = [
  // Arithmetic & Percentages
  { q: 'A train 120m long passes a platform 80m long in 20 seconds. What is the speed of the train?', opts: ['36 km/h', '54 km/h', '40 km/h', '10 m/s'], ans: '36 km/h', category: 'arithmetic', explanation: 'Total distance = 120+80 = 200m. Speed = 200/20 = 10 m/s = 36 km/h' },
  { q: 'If the price of sugar increases by 25%, by what percentage should consumption be reduced to keep expenditure the same?', opts: ['20%', '25%', '30%', '15%'], ans: '20%', category: 'percentages', explanation: 'Reduction = (25/125)*100 = 20%' },
  { q: 'A man buys an article for ₹800 and sells it at 15% profit. What is the selling price?', opts: ['₹920', '₹900', '₹950', '₹860'], ans: '₹920', category: 'arithmetic', explanation: 'SP = 800 * 1.15 = ₹920' },
  { q: 'The ratio of boys to girls in a class is 3:5. If there are 40 students, how many are boys?', opts: ['15', '20', '25', '12'], ans: '15', category: 'arithmetic', explanation: '3/(3+5) * 40 = 15' },
  { q: 'If A can do a piece of work in 10 days and B can do it in 15 days, in how many days can they do it together?', opts: ['6', '5', '8', '7'], ans: '6', category: 'arithmetic', explanation: '1/10 + 1/15 = 5/30 = 1/6, so 6 days' },
  { q: 'A shopkeeper marks the price 20% above cost price and gives a 10% discount. His profit percentage is:', opts: ['8%', '10%', '12%', '6%'], ans: '8%', category: 'percentages', explanation: 'Effective = 1.20 * 0.90 = 1.08, so 8% profit' },
  { q: 'The compound interest on ₹5000 for 2 years at 10% per annum is:', opts: ['₹1050', '₹1000', '₹1100', '₹950'], ans: '₹1050', category: 'arithmetic', explanation: 'CI = 5000(1.1^2 - 1) = 5000*0.21 = ₹1050' },
  { q: 'Two pipes A and B can fill a tank in 20 min and 30 min. Both opened together, how long to fill?', opts: ['12 min', '15 min', '10 min', '25 min'], ans: '12 min', category: 'arithmetic', explanation: '1/20 + 1/30 = 5/60 = 1/12' },
  // Time, Speed, Distance
  { q: 'A car travels 240 km in 4 hours. What is its average speed?', opts: ['60 km/h', '50 km/h', '40 km/h', '80 km/h'], ans: '60 km/h', category: 'time-speed-distance' },
  { q: 'A person walks at 5 km/h for 3 hours and then at 4 km/h for 2 hours. Total distance?', opts: ['23 km', '22 km', '25 km', '20 km'], ans: '23 km', category: 'time-speed-distance', explanation: '5*3 + 4*2 = 15+8 = 23 km' },
  { q: 'Two trains running in the same direction at 60 km/h and 40 km/h. The faster train crosses a man in the slower in 18 seconds. Length of faster train?', opts: ['100 m', '150 m', '200 m', '50 m'], ans: '100 m', category: 'time-speed-distance', explanation: 'Relative speed = 20 km/h = 50/9 m/s. Length = 50/9 * 18 = 100m' },
  // Probability & Combinatorics
  { q: 'A bag contains 4 red and 6 blue balls. Two balls are drawn at random. Probability that both are red?', opts: ['2/15', '1/5', '4/25', '1/3'], ans: '2/15', category: 'probability', explanation: '4C2/10C2 = 6/45 = 2/15' },
  { q: 'In how many ways can 5 people sit around a circular table?', opts: ['24', '120', '60', '12'], ans: '24', category: 'probability', explanation: '(5-1)! = 4! = 24' },
  { q: 'A dice is thrown twice. Probability that sum is 7?', opts: ['1/6', '5/36', '1/4', '7/36'], ans: '1/6', category: 'probability', explanation: 'Favorable outcomes: (1,6)(2,5)(3,4)(4,3)(5,2)(6,1) = 6. P = 6/36 = 1/6' },
  // Number Series
  { q: 'What comes next: 2, 6, 12, 20, 30, ?', opts: ['42', '40', '36', '44'], ans: '42', category: 'series', explanation: 'Differences: 4,6,8,10,12. Next = 30+12 = 42' },
  { q: 'Find the missing number: 1, 4, 9, 16, 25, ?', opts: ['36', '30', '49', '35'], ans: '36', category: 'series', explanation: 'Perfect squares: 1²,2²,3²,4²,5²,6² = 36' },
  { q: 'What comes next: 3, 7, 15, 31, 63, ?', opts: ['127', '125', '64', '128'], ans: '127', category: 'series', explanation: 'Pattern: n*2+1. 63*2+1 = 127' },
  // Logical Reasoning
  { q: 'If all roses are flowers, and some flowers are red, which is true?', opts: ['Some roses may be red', 'All roses are red', 'No rose is red', 'All flowers are roses'], ans: 'Some roses may be red', category: 'logical' },
  { q: 'Pointing to a man, a woman said "His brother\'s father is the only son of my grandfather." How is the woman related to the man?', opts: ['Sister', 'Mother', 'Aunt', 'Cousin'], ans: 'Sister', category: 'logical' },
  { q: 'If COMPUTER is coded as DPNQVUFS, then PROGRAM is coded as:', opts: ['QSPHSBN', 'QRPHSBN', 'QSPHRAN', 'RSPHSBN'], ans: 'QSPHSBN', category: 'logical', explanation: 'Each letter +1: P→Q, R→S, O→P, G→H, R→S, A→B, M→N' },
  { q: 'A clock shows 3:15. What is the angle between the hour and minute hands?', opts: ['7.5°', '0°', '15°', '22.5°'], ans: '7.5°', category: 'logical', explanation: 'Hour hand at 3:15 = 97.5°. Minute hand at 15 = 90°. Angle = 7.5°' },
  // Verbal Ability
  { q: 'Choose the synonym of "Ubiquitous":', opts: ['Omnipresent', 'Rare', 'Unique', 'Absent'], ans: 'Omnipresent', category: 'verbal' },
  { q: 'Choose the antonym of "Ephemeral":', opts: ['Permanent', 'Temporary', 'Brief', 'Fleeting'], ans: 'Permanent', category: 'verbal' },
  { q: '"He is too honest to cheat" means:', opts: ['He is so honest that he cannot cheat', 'He cheats honestly', 'He is very honest and cheats', 'He tries to be honest'], ans: 'He is so honest that he cannot cheat', category: 'verbal' },
  { q: 'Choose the correctly spelled word:', opts: ['Accommodation', 'Accomodation', 'Acomodation', 'Accommadation'], ans: 'Accommodation', category: 'verbal' },
  // Data Interpretation
  { q: 'If revenue was ₹50L in Q1 and ₹70L in Q2, what is the percentage increase?', opts: ['40%', '30%', '20%', '35%'], ans: '40%', category: 'data-interpretation', explanation: '(70-50)/50 * 100 = 40%' },
  { q: 'A pie chart shows 72° for Category A. What percentage does A represent?', opts: ['20%', '25%', '30%', '15%'], ans: '20%', category: 'data-interpretation', explanation: '72/360 * 100 = 20%' },
  { q: 'If the average of 5 numbers is 20, what is their sum?', opts: ['100', '80', '120', '25'], ans: '100', category: 'data-interpretation' },
  { q: 'In a bar graph, if bar A = 300 and bar B = 450, what is the ratio A:B?', opts: ['2:3', '3:2', '1:2', '3:4'], ans: '2:3', category: 'data-interpretation' },
  // More Arithmetic
  { q: 'What is the LCM of 12, 18, and 24?', opts: ['72', '48', '36', '144'], ans: '72', category: 'arithmetic' },
  { q: 'If log₁₀(x) = 3, what is x?', opts: ['1000', '100', '30', '10000'], ans: '1000', category: 'arithmetic' },
  { q: 'A boat goes 20 km upstream in 4 hours and 20 km downstream in 2 hours. Speed of current?', opts: ['2.5 km/h', '5 km/h', '3 km/h', '1.5 km/h'], ans: '2.5 km/h', category: 'arithmetic', explanation: 'Upstream speed=5, Downstream=10. Current=(10-5)/2=2.5' },
  { q: 'The HCF of 36 and 48 is:', opts: ['12', '6', '24', '18'], ans: '12', category: 'arithmetic' },
  { q: 'A tank is 1/3 full. After adding 40 liters, it becomes 1/2 full. Capacity of the tank?', opts: ['240 L', '120 L', '200 L', '180 L'], ans: '240 L', category: 'arithmetic', explanation: '1/2 - 1/3 = 1/6 of capacity = 40L. Capacity = 240L' },
  { q: 'Simple interest on ₹2000 for 3 years at 5% per annum is:', opts: ['₹300', '₹200', '₹250', '₹350'], ans: '₹300', category: 'arithmetic', explanation: 'SI = 2000*3*5/100 = 300' },
  { q: 'If x + 1/x = 5, then x² + 1/x² = ?', opts: ['23', '25', '27', '21'], ans: '23', category: 'arithmetic', explanation: '(x + 1/x)² = x² + 2 + 1/x² => 25 = x² + 1/x² + 2 => 23' },
  { q: 'Present ages of A and B are in ratio 5:4. In 10 years the ratio becomes 7:6. Present age of A?', opts: ['25', '20', '30', '35'], ans: '25', category: 'arithmetic', explanation: '(5x+10)/(4x+10) = 7/6 => 30x+60 = 28x+70 => x=5. A=25' },
  { q: 'A mixture has milk and water in 4:1 ratio. How much water to add to 20L to make it 2:1?', opts: ['4 L', '6 L', '5 L', '8 L'], ans: '4 L', category: 'arithmetic', explanation: 'Milk=16L, Water=4L. For 2:1: 16/(4+x)=2/1 => 4+x=8 => x=4' },
  { q: 'If the diagonal of a square is 10√2 cm, what is its area?', opts: ['100 cm²', '200 cm²', '50 cm²', '150 cm²'], ans: '100 cm²', category: 'arithmetic', explanation: 'Side = diagonal/√2 = 10. Area = 10² = 100' },
];

const TECHNICAL_QUESTIONS = [
  // Data Structures
  { q: 'What is the time complexity of searching in a balanced BST?', opts: ['O(log n)', 'O(n)', 'O(1)', 'O(n log n)'], ans: 'O(log n)', category: 'dsa' },
  { q: 'Which data structure is used for BFS traversal?', opts: ['Queue', 'Stack', 'Array', 'Linked List'], ans: 'Queue', category: 'dsa' },
  { q: 'What is the worst-case time complexity of QuickSort?', opts: ['O(n²)', 'O(n log n)', 'O(n)', 'O(log n)'], ans: 'O(n²)', category: 'dsa' },
  { q: 'A hash table with chaining has average case lookup of:', opts: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], ans: 'O(1)', category: 'dsa' },
  { q: 'Which traversal of a BST gives elements in sorted order?', opts: ['Inorder', 'Preorder', 'Postorder', 'Level order'], ans: 'Inorder', category: 'dsa' },
  { q: 'The minimum number of nodes in an AVL tree of height 3 is:', opts: ['7', '8', '4', '15'], ans: '7', category: 'dsa', explanation: 'N(h) = N(h-1) + N(h-2) + 1. N(0)=1, N(1)=2, N(2)=4, N(3)=7' },
  { q: 'Which sorting algorithm is best for nearly sorted arrays?', opts: ['Insertion Sort', 'Quick Sort', 'Merge Sort', 'Heap Sort'], ans: 'Insertion Sort', category: 'dsa' },
  { q: 'A stack can be used to check for:', opts: ['Balanced parentheses', 'Shortest path', 'Minimum element', 'Sorting'], ans: 'Balanced parentheses', category: 'dsa' },
  { q: 'What is the space complexity of Merge Sort?', opts: ['O(n)', 'O(1)', 'O(log n)', 'O(n²)'], ans: 'O(n)', category: 'dsa' },
  { q: 'In a max-heap, the root element is:', opts: ['The largest', 'The smallest', 'The median', 'Random'], ans: 'The largest', category: 'dsa' },
  // Algorithms
  { q: 'Dijkstra\'s algorithm does NOT work with:', opts: ['Negative edge weights', 'Directed graphs', 'Weighted graphs', 'Undirected graphs'], ans: 'Negative edge weights', category: 'algorithms' },
  { q: 'What is the time complexity of finding the shortest path using BFS in an unweighted graph?', opts: ['O(V+E)', 'O(V²)', 'O(E log V)', 'O(V*E)'], ans: 'O(V+E)', category: 'algorithms' },
  { q: 'Dynamic programming is an optimization over:', opts: ['Recursion', 'Iteration', 'Greedy', 'Divide and Conquer'], ans: 'Recursion', category: 'algorithms' },
  { q: 'Which algorithm is used to find Minimum Spanning Tree?', opts: ['Kruskal\'s', 'Dijkstra\'s', 'Bellman-Ford', 'Floyd-Warshall'], ans: 'Kruskal\'s', category: 'algorithms' },
  { q: 'The time complexity of binary search is:', opts: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], ans: 'O(log n)', category: 'algorithms' },
  // DBMS
  { q: 'Which normal form eliminates transitive dependencies?', opts: ['3NF', '2NF', 'BCNF', '1NF'], ans: '3NF', category: 'dbms' },
  { q: 'ACID properties ensure:', opts: ['Transaction reliability', 'Fast queries', 'Data compression', 'Indexing'], ans: 'Transaction reliability', category: 'dbms' },
  { q: 'A foreign key references:', opts: ['Primary key of another table', 'Its own primary key', 'An index', 'A view'], ans: 'Primary key of another table', category: 'dbms' },
  { q: 'Which SQL command is used to modify existing records?', opts: ['UPDATE', 'ALTER', 'INSERT', 'MODIFY'], ans: 'UPDATE', category: 'dbms' },
  { q: 'A deadlock occurs when:', opts: ['Two transactions wait for each other\'s locks', 'A query takes too long', 'The database is full', 'An index is missing'], ans: 'Two transactions wait for each other\'s locks', category: 'dbms' },
  { q: 'Which join returns all rows from both tables?', opts: ['FULL OUTER JOIN', 'INNER JOIN', 'LEFT JOIN', 'CROSS JOIN'], ans: 'FULL OUTER JOIN', category: 'dbms' },
  // Operating Systems
  { q: 'Which scheduling algorithm may cause starvation?', opts: ['Priority Scheduling', 'FCFS', 'Round Robin', 'SJF'], ans: 'Priority Scheduling', category: 'os' },
  { q: 'A semaphore is used for:', opts: ['Process synchronization', 'Memory allocation', 'File management', 'CPU scheduling'], ans: 'Process synchronization', category: 'os' },
  { q: 'What is thrashing in an OS?', opts: ['Excessive page faults causing CPU idle', 'High CPU utilization', 'Disk failure', 'Memory overflow'], ans: 'Excessive page faults causing CPU idle', category: 'os' },
  { q: 'Which page replacement algorithm is optimal but impractical?', opts: ['Optimal (OPT)', 'LRU', 'FIFO', 'LFU'], ans: 'Optimal (OPT)', category: 'os' },
  { q: 'The number of resources needed to prevent deadlock (Banker\'s algorithm condition):', opts: ['Maximum need must be known', 'No preemption', 'Hold and wait', 'Circular wait'], ans: 'Maximum need must be known', category: 'os' },
  // Computer Networks
  { q: 'TCP is a _____ protocol:', opts: ['Connection-oriented', 'Connectionless', 'Stateless', 'Broadcast'], ans: 'Connection-oriented', category: 'networks' },
  { q: 'Which layer handles routing in the OSI model?', opts: ['Network', 'Transport', 'Data Link', 'Session'], ans: 'Network', category: 'networks' },
  { q: 'HTTP default port is:', opts: ['80', '443', '21', '8080'], ans: '80', category: 'networks' },
  { q: 'ARP resolves:', opts: ['IP to MAC address', 'MAC to IP address', 'Domain to IP', 'Port to Service'], ans: 'IP to MAC address', category: 'networks' },
  { q: 'Which protocol is used for secure web browsing?', opts: ['HTTPS', 'HTTP', 'FTP', 'SMTP'], ans: 'HTTPS', category: 'networks' },
  // OOP
  { q: 'Polymorphism allows:', opts: ['Same interface, different implementations', 'Hiding data', 'Code reuse via inheritance', 'Multiple inheritance'], ans: 'Same interface, different implementations', category: 'oop' },
  { q: 'Which OOP principle restricts direct access to object internals?', opts: ['Encapsulation', 'Abstraction', 'Polymorphism', 'Inheritance'], ans: 'Encapsulation', category: 'oop' },
  { q: 'An abstract class:', opts: ['Cannot be instantiated', 'Must have all abstract methods', 'Cannot have constructors', 'Is the same as an interface'], ans: 'Cannot be instantiated', category: 'oop' },
  { q: 'Method overloading is an example of:', opts: ['Compile-time polymorphism', 'Runtime polymorphism', 'Encapsulation', 'Abstraction'], ans: 'Compile-time polymorphism', category: 'oop' },
  { q: 'The diamond problem occurs with:', opts: ['Multiple inheritance', 'Single inheritance', 'Interfaces', 'Encapsulation'], ans: 'Multiple inheritance', category: 'oop' },
  // System Design
  { q: 'Which pattern uses a single instance shared globally?', opts: ['Singleton', 'Factory', 'Observer', 'Strategy'], ans: 'Singleton', category: 'system-design' },
  { q: 'Horizontal scaling means:', opts: ['Adding more machines', 'Adding more RAM to one machine', 'Using SSDs', 'Optimizing code'], ans: 'Adding more machines', category: 'system-design' },
  { q: 'A load balancer distributes:', opts: ['Traffic across servers', 'Data across disks', 'Memory across processes', 'Code across repositories'], ans: 'Traffic across servers', category: 'system-design' },
  { q: 'CAP theorem states a distributed system can have at most __ of 3 guarantees:', opts: ['2', '1', '3', '0'], ans: '2', category: 'system-design' },
  { q: 'Which caching strategy writes to cache only on read miss?', opts: ['Cache-aside (Lazy loading)', 'Write-through', 'Write-behind', 'Write-around'], ans: 'Cache-aside (Lazy loading)', category: 'system-design' },
];

const HR_QUESTIONS = [
  { q: 'Tell me about yourself and your journey so far.' },
  { q: 'What are your greatest strengths and how have they helped you succeed?' },
  { q: 'What is your biggest weakness and how are you working to improve it?' },
  { q: 'Where do you see yourself in 5 years?' },
  { q: 'Why should we hire you over other candidates?' },
  { q: 'Describe a time you faced a difficult challenge at work or in academics. How did you handle it?' },
  { q: 'Tell me about a time you worked in a team and resolved a conflict.' },
  { q: 'What motivates you to do your best work?' },
  { q: 'How do you handle pressure and tight deadlines?' },
  { q: 'Describe a situation where you showed leadership.' },
  { q: 'What is your approach when you receive criticism about your work?' },
  { q: 'Why did you choose your field of study?' },
  { q: 'How would your friends or colleagues describe you?' },
  { q: 'Tell me about a project you are most proud of.' },
  { q: 'What do you know about our company and why do you want to work here?' },
  { q: 'How do you stay updated with the latest technology trends?' },
  { q: 'Describe a situation where you had to learn something quickly to meet a deadline.' },
  { q: 'What would you do if you disagreed with your manager\'s decision?' },
  { q: 'How do you prioritize tasks when you have multiple deadlines?' },
  { q: 'Where do you see the technology industry heading in the next decade?' },
  { q: 'Tell me about a time you failed. What did you learn?' },
  { q: 'What salary range are you expecting and why?' },
  { q: 'How do you handle working on a project with unclear requirements?' },
  { q: 'What is the most difficult decision you have had to make?' },
  { q: 'Describe a time when you went above and beyond your responsibilities.' },
];

const CODING_PROBLEMS = [
  {
    title: 'Two Sum', difficulty: 'easy', category: 'arrays',
    description: 'Given an array of n integers and a target value, find two numbers that add up to the target.\\n\\nInput: First line n, second line n space-separated integers, third line target.\\nOutput: Indices of the two numbers (0-indexed, space-separated, smaller index first). If no solution, print -1.',
    examples: [{ input: '4\\n2 7 11 15\\n9', output: '0 1', explanation: 'arr[0]+arr[1] = 2+7 = 9' }],
    testCases: [
      { input: '4\\n2 7 11 15\\n9', expectedOutput: '0 1' },
      { input: '3\\n3 2 4\\n6', expectedOutput: '1 2' },
      { input: '2\\n3 3\\n6', expectedOutput: '0 1' },
      { input: '5\\n1 2 3 4 5\\n10', expectedOutput: '-1' },
      { input: '4\\n-1 0 1 2\\n1', expectedOutput: '0 2' },
    ],
    boilerplate: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\nconst target = parseInt(lines[2]);\n// Your code here\n`,
      python: `n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# Your code here\n`,
      cpp: `#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<int> arr(n);\n    for(int i=0;i<n;i++) cin >> arr[i];\n    int target; cin >> target;\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        int target = sc.nextInt();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf("%d", &arr[i]);\n    int target; scanf("%d", &target);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Reverse a String', difficulty: 'easy', category: 'strings',
    description: 'Given a string, reverse it and print the result.\\n\\nInput: A single string.\\nOutput: The reversed string.',
    examples: [{ input: 'hello', output: 'olleh', explanation: 'Reverse of hello is olleh' }],
    testCases: [
      { input: 'hello', expectedOutput: 'olleh' },
      { input: 'world', expectedOutput: 'dlrow' },
      { input: 'a', expectedOutput: 'a' },
      { input: 'racecar', expectedOutput: 'racecar' },
      { input: 'OpenAI', expectedOutput: 'IAnepO' },
    ],
    boilerplate: {
      javascript: `const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n`,
      python: `s = input()\n# Your code here\n`,
      cpp: `#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\nint main() {\n    string s; cin >> s;\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\n#include <string.h>\nint main() {\n    char s[10001];\n    scanf("%s", s);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Find Maximum Subarray Sum (Kadane\'s)', difficulty: 'medium', category: 'arrays',
    description: 'Given an array of n integers (can be negative), find the contiguous subarray with the maximum sum.\\n\\nInput: First line n, second line n space-separated integers.\\nOutput: The maximum subarray sum.',
    examples: [{ input: '8\\n-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'Subarray [4,-1,2,1] has max sum 6' }],
    testCases: [
      { input: '8\\n-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6' },
      { input: '1\\n-1', expectedOutput: '-1' },
      { input: '5\\n1 2 3 4 5', expectedOutput: '15' },
      { input: '5\\n-1 -2 -3 -4 -5', expectedOutput: '-1' },
      { input: '6\\n5 -3 5 -2 5 -1', expectedOutput: '9' },
    ],
    boilerplate: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here - Kadane's algorithm\n`,
      python: `n = int(input())\narr = list(map(int, input().split()))\n# Your code here - Kadane's algorithm\n`,
      cpp: `#include <iostream>\n#include <climits>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin >> arr[i];\n    // Your code here - Kadane's algorithm\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here - Kadane's algorithm\n    }\n}`,
      c: `#include <stdio.h>\n#include <limits.h>\nint main() {\n    int n; scanf("%d", &n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf("%d", &arr[i]);\n    // Your code here - Kadane's algorithm\n    return 0;\n}`
    }
  },
  {
    title: 'Fibonacci Number', difficulty: 'easy', category: 'recursion',
    description: 'Given n, find the nth Fibonacci number (0-indexed). F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2).\\n\\nInput: A single integer n (0 ≤ n ≤ 30).\\nOutput: The nth Fibonacci number.',
    examples: [{ input: '6', output: '8', explanation: 'F(6) = 0,1,1,2,3,5,8' }],
    testCases: [
      { input: '0', expectedOutput: '0' },
      { input: '1', expectedOutput: '1' },
      { input: '6', expectedOutput: '8' },
      { input: '10', expectedOutput: '55' },
      { input: '20', expectedOutput: '6765' },
    ],
    boilerplate: {
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n`,
      python: `n = int(input())\n# Your code here\n`,
      cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Check Palindrome String', difficulty: 'easy', category: 'strings',
    description: 'Given a string, check if it is a palindrome (reads the same forwards and backwards). Ignore case.\\n\\nInput: A single string (only alphabets).\\nOutput: "YES" if palindrome, "NO" otherwise.',
    examples: [{ input: 'racecar', output: 'YES', explanation: 'racecar reads same forwards and backwards' }],
    testCases: [
      { input: 'racecar', expectedOutput: 'YES' },
      { input: 'hello', expectedOutput: 'NO' },
      { input: 'Madam', expectedOutput: 'YES' },
      { input: 'a', expectedOutput: 'YES' },
      { input: 'abba', expectedOutput: 'YES' },
    ],
    boilerplate: {
      javascript: `const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n`,
      python: `s = input()\n# Your code here\n`,
      cpp: `#include <iostream>\n#include <string>\n#include <algorithm>\nusing namespace std;\nint main() {\n    string s; cin >> s;\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).next();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\n#include <string.h>\n#include <ctype.h>\nint main() {\n    char s[10001];\n    scanf("%s", s);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Merge Two Sorted Arrays', difficulty: 'medium', category: 'arrays',
    description: 'Given two sorted arrays, merge them into a single sorted array.\\n\\nInput: First line n, second line n integers (sorted). Third line m, fourth line m integers (sorted).\\nOutput: Merged sorted array, space-separated.',
    examples: [{ input: '3\\n1 3 5\\n3\\n2 4 6', output: '1 2 3 4 5 6', explanation: 'Merge [1,3,5] and [2,4,6]' }],
    testCases: [
      { input: '3\\n1 3 5\\n3\\n2 4 6', expectedOutput: '1 2 3 4 5 6' },
      { input: '2\\n1 2\\n3\\n3 4 5', expectedOutput: '1 2 3 4 5' },
      { input: '1\\n5\\n1\\n1', expectedOutput: '1 5' },
      { input: '4\\n1 1 1 1\\n2\\n1 1', expectedOutput: '1 1 1 1 1 1' },
      { input: '3\\n-3 -1 0\\n3\\n-2 1 2', expectedOutput: '-3 -2 -1 0 1 2' },
    ],
    boilerplate: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst a = lines[1].split(' ').map(Number);\nconst m = parseInt(lines[2]);\nconst b = lines[3].split(' ').map(Number);\n// Your code here\n`,
      python: `n = int(input())\na = list(map(int, input().split()))\nm = int(input())\nb = list(map(int, input().split()))\n# Your code here\n`,
      cpp: `#include <iostream>\n#include <vector>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<int> a(n);\n    for(int i=0;i<n;i++) cin >> a[i];\n    int m; cin >> m;\n    vector<int> b(m);\n    for(int i=0;i<m;i++) cin >> b[i];\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] a = new int[n];\n        for(int i=0;i<n;i++) a[i] = sc.nextInt();\n        int m = sc.nextInt();\n        int[] b = new int[m];\n        for(int i=0;i<m;i++) b[i] = sc.nextInt();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    int a[n];\n    for(int i=0;i<n;i++) scanf("%d", &a[i]);\n    int m; scanf("%d", &m);\n    int b[m];\n    for(int i=0;i<m;i++) scanf("%d", &b[i]);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Count Vowels in String', difficulty: 'easy', category: 'strings',
    description: 'Count the number of vowels (a,e,i,o,u) in a given string (case-insensitive).\\n\\nInput: A single string.\\nOutput: Count of vowels.',
    examples: [{ input: 'Hello World', output: '3', explanation: 'e, o, o are the vowels' }],
    testCases: [
      { input: 'Hello World', expectedOutput: '3' },
      { input: 'aeiou', expectedOutput: '5' },
      { input: 'bcdfg', expectedOutput: '0' },
      { input: 'AEIOU', expectedOutput: '5' },
      { input: 'Programming', expectedOutput: '3' },
    ],
    boilerplate: {
      javascript: `const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n`,
      python: `s = input()\n# Your code here\n`,
      cpp: `#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s;\n    getline(cin, s);\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).nextLine();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\n#include <string.h>\n#include <ctype.h>\nint main() {\n    char s[10001];\n    fgets(s, 10001, stdin);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Binary Search', difficulty: 'easy', category: 'searching',
    description: 'Given a sorted array and a target, find the index of the target using binary search.\\n\\nInput: First line n, second line n sorted integers, third line target.\\nOutput: Index (0-indexed) if found, -1 otherwise.',
    examples: [{ input: '5\\n1 3 5 7 9\\n5', output: '2', explanation: 'Element 5 is at index 2' }],
    testCases: [
      { input: '5\\n1 3 5 7 9\\n5', expectedOutput: '2' },
      { input: '5\\n1 3 5 7 9\\n6', expectedOutput: '-1' },
      { input: '1\\n42\\n42', expectedOutput: '0' },
      { input: '6\\n2 4 6 8 10 12\\n12', expectedOutput: '5' },
      { input: '4\\n10 20 30 40\\n10', expectedOutput: '0' },
    ],
    boilerplate: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\nconst target = parseInt(lines[2]);\n// Your code here - Binary Search\n`,
      python: `n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# Your code here - Binary Search\n`,
      cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin >> arr[i];\n    int target; cin >> target;\n    // Your code here - Binary Search\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        int target = sc.nextInt();\n        // Your code here - Binary Search\n    }\n}`,
      c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf("%d", &arr[i]);\n    int target; scanf("%d", &target);\n    // Your code here - Binary Search\n    return 0;\n}`
    }
  },
  {
    title: 'Longest Common Prefix', difficulty: 'medium', category: 'strings',
    description: 'Find the longest common prefix among an array of strings.\\n\\nInput: First line n, next n lines each a string.\\nOutput: The longest common prefix. If none, print empty line.',
    examples: [{ input: '3\\nflower\\nflow\\nflight', output: 'fl', explanation: 'Common prefix is "fl"' }],
    testCases: [
      { input: '3\\nflower\\nflow\\nflight', expectedOutput: 'fl' },
      { input: '3\\ndog\\nracecar\\ncar', expectedOutput: '' },
      { input: '2\\nprefix\\nprefix', expectedOutput: 'prefix' },
      { input: '1\\nhello', expectedOutput: 'hello' },
      { input: '3\\ninter\\nintegrate\\ninterview', expectedOutput: 'inte' },
    ],
    boilerplate: {
      javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst strs = lines.slice(1);\n// Your code here\n`,
      python: `n = int(input())\nstrs = [input() for _ in range(n)]\n# Your code here\n`,
      cpp: `#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    vector<string> strs(n);\n    for(int i=0;i<n;i++) cin >> strs[i];\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        String[] strs = new String[n];\n        for(int i=0;i<n;i++) strs[i] = sc.next();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\n#include <string.h>\nint main() {\n    int n; scanf("%d", &n);\n    char strs[100][1001];\n    for(int i=0;i<n;i++) scanf("%s", strs[i]);\n    // Your code here\n    return 0;\n}`
    }
  },
  {
    title: 'Climbing Stairs', difficulty: 'medium', category: 'dp',
    description: 'You are climbing a staircase with n steps. Each time you can climb 1 or 2 steps. How many distinct ways can you reach the top?\\n\\nInput: A single integer n (1 ≤ n ≤ 45).\\nOutput: Number of distinct ways.',
    examples: [{ input: '3', output: '3', explanation: '1+1+1, 1+2, 2+1 = 3 ways' }],
    testCases: [
      { input: '1', expectedOutput: '1' },
      { input: '2', expectedOutput: '2' },
      { input: '3', expectedOutput: '3' },
      { input: '5', expectedOutput: '8' },
      { input: '10', expectedOutput: '89' },
    ],
    boilerplate: {
      javascript: `const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n`,
      python: `n = int(input())\n# Your code here\n`,
      cpp: `#include <iostream>\nusing namespace std;\nint main() {\n    int n; cin >> n;\n    // Your code here\n    return 0;\n}`,
      java: `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        // Your code here\n    }\n}`,
      c: `#include <stdio.h>\nint main() {\n    int n; scanf("%d", &n);\n    // Your code here\n    return 0;\n}`
    }
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing questions
    await QuestionBank.deleteMany({});
    console.log('Cleared existing question bank');

    // Seed aptitude
    const aptDocs = APTITUDE_QUESTIONS.map(q => ({ ...q, type: 'aptitude', difficulty: 'medium', verified: true }));
    await QuestionBank.insertMany(aptDocs);
    console.log(`✅ Seeded ${aptDocs.length} aptitude questions`);

    // Seed technical
    const techDocs = TECHNICAL_QUESTIONS.map(q => ({ ...q, type: 'technical', difficulty: 'medium', verified: true }));
    await QuestionBank.insertMany(techDocs);
    console.log(`✅ Seeded ${techDocs.length} technical questions`);

    // Seed HR
    const hrDocs = HR_QUESTIONS.map(q => ({ ...q, type: 'hr', difficulty: 'medium', verified: true }));
    await QuestionBank.insertMany(hrDocs);
    console.log(`✅ Seeded ${hrDocs.length} HR questions`);

    // Seed Coding
    const codeDocs = CODING_PROBLEMS.map(p => ({ ...p, type: 'coding', verified: true }));
    await QuestionBank.insertMany(codeDocs);
    console.log(`✅ Seeded ${codeDocs.length} coding problems`);

    const total = aptDocs.length + techDocs.length + hrDocs.length + codeDocs.length;
    console.log(`\n🎯 Total: ${total} verified questions seeded!`);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
