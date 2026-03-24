require('dotenv').config();
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const Resource = require('../models/Resource');

const MONGODB_URI = process.env.MONGODB_URI;

const topicsData = [
  { name: 'Data Structures & Algorithms', description: 'Arrays, linked lists, trees, graphs, sorting, searching, dynamic programming, greedy algorithms, and more.' },
  { name: 'Database Management Systems', description: 'SQL, normalization, ER diagrams, transactions, indexing, NoSQL databases.' },
  { name: 'Object-Oriented Programming', description: 'Classes, objects, inheritance, polymorphism, encapsulation, abstraction, design patterns.' },
  { name: 'Operating Systems', description: 'Process management, memory management, file systems, CPU scheduling, deadlocks, threads.' },
  { name: 'Computer Networks', description: 'OSI model, TCP/IP, HTTP, DNS, routing, subnetting, firewalls, network security.' },
  { name: 'System Design', description: 'Scalable systems, load balancing, caching, databases, microservices, system architecture.' },
  { name: 'Web Development', description: 'HTML, CSS, JavaScript, React, Node.js, REST APIs, full-stack development.' },
  { name: 'SQL & Databases', description: 'SQL queries, joins, subqueries, stored procedures, PostgreSQL, MySQL, MongoDB.' },
  { name: 'Aptitude & Reasoning', description: 'Quantitative aptitude, logical reasoning, verbal ability, puzzles for placement tests.' },
  { name: 'Java Programming', description: 'Core Java, collections, multithreading, JVM, Spring Boot, Java patterns.' },
  { name: 'Python Programming', description: 'Python fundamentals, data structures, OOP, libraries, Django, Flask, automation.' },
  { name: 'C/C++ Programming', description: 'Pointers, memory management, STL, templates, competitive programming in C++.' },
];

const resourceSets = {
  'Data Structures & Algorithms': [
    // Videos
    { title: 'DSA Full Course by Abdul Bari', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=0IAPZzGSbME', description: 'Complete DSA course covering all fundamental concepts' },
    { title: 'Striver A2Z DSA Sheet - Introduction', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=0bHoB32fuj0', description: 'Introduction to Striver A2Z DSA roadmap' },
    { title: 'Arrays - Complete Tutorial', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=NTHVTY6w2Co', description: 'Everything about arrays in programming' },
    { title: 'Linked Lists Explained', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=R9PTBwOzceo', description: 'Singly, doubly, and circular linked lists' },
    { title: 'Stack Data Structure', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=bxRVz8zklWM', description: 'Stack operations, applications, and implementation' },
    { title: 'Queue & Deque Tutorial', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=M6GnoUDpqEE', description: 'Queue implementations and BFS applications' },
    { title: 'Binary Trees Introduction', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=YAdLFsTG70w', description: 'Binary tree traversals and properties' },
    { title: 'Binary Search Trees', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=cySVml6e_Fc', description: 'BST operations - insert, delete, search' },
    { title: 'AVL Trees & Rotations', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=jDM6_TnYIqE', description: 'Self-balancing BST with rotations' },
    { title: 'Heap & Priority Queue', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=HqPJF2L5h9U', description: 'Min/Max heap operations and heap sort' },
    { title: 'Graph Theory - BFS & DFS', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=tWVWeAqZ0WU', description: 'Graph traversal algorithms explained' },
    { title: 'Dijkstra Shortest Path', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=V6H1qAeB-l4', description: 'Single source shortest path algorithm' },
    { title: 'Dynamic Programming - Intro', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=oBt53YbR9Kk', description: 'DP concepts with memoization and tabulation' },
    { title: 'DP on Subsequences', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=IsvocB5BJhw', description: 'LIS, LCS, and subset sum problems' },
    { title: 'Greedy Algorithms', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=HzeK7g8cD0Y', description: 'Activity selection, Huffman coding, fractional knapsack' },
    { title: 'Backtracking - N Queens', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=i05Ju7AftcM', description: 'N-Queens and Sudoku solver using backtracking' },
    { title: 'Trie Data Structure', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=oobqoCJlHA0', description: 'Prefix trees and autocomplete implementation' },
    { title: 'Segment Trees', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=ZBHKZF5w4YU', description: 'Range queries and lazy propagation' },
    { title: 'Recursion for Beginners', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=kHi1DUhp9kM', description: 'Understanding recursion step by step' },
    { title: 'Sorting Algorithms Visualized', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=kPRA0W1kECg', description: 'Bubble, selection, insertion, merge, quick sort' },
    // Articles
    { title: 'Big-O Notation Explained', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/analysis-algorithms-big-o-analysis/', description: 'Time and space complexity analysis guide' },
    { title: 'Top 50 Array Problems', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/top-50-array-problems/', description: 'Must-solve array problems for interviews' },
    { title: 'Top 50 String Problems', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/top-50-string-problems/', description: 'Essential string manipulation problems' },
    { title: 'Graph Algorithms Cheat Sheet', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/graph-data-structure-and-algorithms/', description: 'Complete graph algorithms reference' },
    { title: 'DP Problems for Interviews', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/top-50-dynamic-programming-coding-problems/', description: 'Top DP interview problems with solutions' },
    { title: 'Hash Map Implementation Guide', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/hashing-data-structure/', description: 'Hashing techniques and collision resolution' },
    { title: 'Binary Search Patterns', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/binary-search/', description: 'All binary search variations and patterns' },
    { title: 'Two Pointer Technique', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/two-pointers-technique/', description: 'Solving problems with two pointer approach' },
    { title: 'Sliding Window Problems', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/window-sliding-technique/', description: 'Fixed and variable size sliding window' },
    { title: 'Bit Manipulation Tricks', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/bits-manipulation-important-tactics/', description: 'Bitwise operations for competitive programming' },
  ],
  'Database Management Systems': [
    { title: 'DBMS Full Course - Gate Smashers', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=kBdlM6hNDAE', description: 'Complete DBMS from basics to advanced' },
    { title: 'SQL Tutorial for Beginners', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', description: 'Learn SQL from scratch in one video' },
    { title: 'Normalization in DBMS', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=ABwD8IYByfk', description: '1NF, 2NF, 3NF, BCNF explained with examples' },
    { title: 'ER Diagram Tutorial', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=QpdhBUYk7Kk', description: 'Entity-Relationship modeling for database design' },
    { title: 'ACID Properties Explained', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=pomxJOFVcQs', description: 'Transaction management and ACID properties' },
    { title: 'Indexing in Databases', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=fsG1XaZEa78', description: 'B-Tree, B+ Tree indexing techniques' },
    { title: 'SQL Joins Visualized', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=9yeOJ0ZMUYw', description: 'Inner, outer, left, right, cross joins' },
    { title: 'NoSQL vs SQL', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=ZS_kXvOeQ5Y', description: 'When to use NoSQL vs relational databases' },
    { title: 'Transactions and Concurrency Control', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=P80Js_qClUE', description: 'Locks, timestamps, and MVCC' },
    { title: 'Database Sharding Explained', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=5faMjKuB9bc', description: 'Horizontal partitioning for scalability' },
    { title: 'SQL Interview Questions - Top 50', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/sql-interview-questions/', description: 'Most asked SQL questions in interviews' },
    { title: 'DBMS Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/dbms-interview-questions/', description: 'Top DBMS interview questions and answers' },
    { title: 'Relational Algebra', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/introduction-of-relational-algebra-in-dbms/', description: 'Selection, projection, join operations' },
    { title: 'Functional Dependencies', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/types-of-functional-dependencies-in-dbms/', description: 'FDs, closures, and candidate keys' },
    { title: 'Deadlock in DBMS', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/deadlock-in-dbms/', description: 'Detection, prevention, and recovery' },
  ],
  'Object-Oriented Programming': [
    { title: 'OOPs Concepts in Java', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=BSVKUk58K6U', description: 'All OOP pillars explained with Java examples' },
    { title: 'SOLID Principles Explained', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=_jDNAf3CzeY', description: 'Five SOLID design principles' },
    { title: 'Design Patterns - Full Course', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=v9ejT8FO-7I', description: 'Gang of Four design patterns' },
    { title: 'Inheritance vs Composition', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=hxGOiiR9ZKg', description: 'When to use inheritance vs composition' },
    { title: 'Polymorphism Deep Dive', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=jhDUxynEQRI', description: 'Compile-time and runtime polymorphism' },
    { title: 'Abstract Classes vs Interfaces', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=JHv6LGIBEz4', description: 'Key differences and when to use each' },
    { title: 'Encapsulation Explained', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=H5CcSSkfB6U', description: 'Data hiding and access modifiers' },
    { title: 'Factory Design Pattern', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=EcFVTgRHJLM', description: 'Factory and Abstract Factory patterns' },
    { title: 'Observer Design Pattern', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=_BpmfnqjgzQ', description: 'Event-driven programming with observer pattern' },
    { title: 'OOP Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/oops-interview-questions/', description: 'Top 50 OOP interview questions' },
    { title: 'UML Class Diagrams', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/unified-modeling-language-uml-class-diagrams/', description: 'How to read and create class diagrams' },
    { title: 'DRY, KISS, YAGNI Principles', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/kiss-principle-in-software-development/', description: 'Essential software development principles' },
  ],
  'Operating Systems': [
    { title: 'OS Full Course - Gate Smashers', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=bkSWJJZNgf8', description: 'Complete operating system course' },
    { title: 'Process vs Thread', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=Dhf-DYQe_4s', description: 'Processes, threads, and multithreading' },
    { title: 'CPU Scheduling Algorithms', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=EWkQl0n0w5M', description: 'FCFS, SJF, Round Robin, Priority scheduling' },
    { title: 'Deadlocks in OS', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=UVo9mGARkhQ', description: 'Deadlock conditions and Bankers algorithm' },
    { title: 'Virtual Memory & Paging', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=2quKyPnUShQ', description: 'Page tables, TLB, page replacement' },
    { title: 'Semaphores & Mutex', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=XDIOC2MY1JA', description: 'Synchronization mechanisms explained' },
    { title: 'File Systems Overview', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=KN8YgJnShPM', description: 'File allocation, directory structure' },
    { title: 'Memory Management in OS', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=p9yZNLeOj4s', description: 'Contiguous, paging, segmentation' },
    { title: 'OS Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/operating-systems-interview-questions/', description: 'Top 50 OS interview questions' },
    { title: 'Process Synchronization', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/introduction-of-process-synchronization/', description: 'Critical section, Peterson\'s solution' },
    { title: 'Page Replacement Algorithms', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/page-replacement-algorithms-in-operating-systems/', description: 'FIFO, LRU, Optimal page replacement' },
    { title: 'Disk Scheduling Algorithms', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/disk-scheduling-algorithms/', description: 'FCFS, SSTF, SCAN, C-SCAN' },
  ],
  'Computer Networks': [
    { title: 'CN Full Course - Gate Smashers', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=JFF2vJaN0Cw', description: 'Complete computer networks course' },
    { title: 'OSI Model Explained', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=vv4y_uOneC0', description: '7 layers of OSI model' },
    { title: 'TCP vs UDP', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=uwoD5YsGACg', description: 'Comparing transport layer protocols' },
    { title: 'HTTP/HTTPS Deep Dive', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=hExRDVZHhig', description: 'How HTTP works, SSL/TLS' },
    { title: 'DNS Explained', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=27r4Bzuj5NQ', description: 'Domain name resolution process' },
    { title: 'Subnetting Made Easy', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=ZxAwQB8TZsM', description: 'IP subnetting and CIDR notation' },
    { title: 'TCP 3-Way Handshake', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=xMtP5ZB3wSk', description: 'Connection establishment in TCP' },
    { title: 'Routing Algorithms', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=8LVbdx1HWBE', description: 'Distance vector and link state routing' },
    { title: 'Network Security Basics', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=BEv6CCg9OSw', description: 'Firewalls, encryption, VPN' },
    { title: 'CN Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/computer-network-interview-questions/', description: 'Top networking interview questions' },
    { title: 'ARP Protocol', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/how-address-resolution-protocol-arp-works/', description: 'Address resolution protocol explained' },
    { title: 'Socket Programming', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/socket-programming-cc/', description: 'Client-server socket programming' },
  ],
  'System Design': [
    { title: 'System Design Primer', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=0163cssUxLA', description: 'Introduction to system design concepts' },
    { title: 'Design URL Shortener', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=fMZMm_0ZhK4', description: 'System design of TinyURL or Bitly' },
    { title: 'Design Twitter', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=wYk0xPP_P_8', description: 'Designing a social media feed system' },
    { title: 'Load Balancer Explained', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=K0Ta65OqQkY', description: 'Types and algorithms for load balancing' },
    { title: 'Caching Strategies', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=U3RkDLtS7uY', description: 'Redis, Memcached, caching patterns' },
    { title: 'Microservices Architecture', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=CdBtNQZH8a4', description: 'Monolith to microservices transition' },
    { title: 'Database Scaling', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=dkhOZOmV7Fo', description: 'Replication, sharding, partitioning' },
    { title: 'CAP Theorem', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=k-Yaq8AHlFA', description: 'Consistency, availability, partition tolerance' },
    { title: 'Message Queues - Kafka', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=PzPXRmVHMxI', description: 'Event-driven architecture with Kafka' },
    { title: 'API Design Best Practices', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/rest-api-introduction/', description: 'RESTful API design principles' },
    { title: 'Rate Limiting Strategies', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/rate-limiting-api-gateway/', description: 'Token bucket, leaky bucket algorithms' },
  ],
  'Web Development': [
    { title: 'HTML CSS JS Full Course', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=mU6anWqZJcc', description: 'Complete web development basics' },
    { title: 'React Full Course 2024', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=bMknfKXIFA8', description: 'React.js complete tutorial' },
    { title: 'Node.js & Express Tutorial', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=Oe421EPjeBE', description: 'Building REST APIs with Node.js' },
    { title: 'MongoDB Complete Course', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=ExcRbA7fy_A', description: 'NoSQL database with MongoDB' },
    { title: 'CSS Flexbox & Grid', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=JJSoEo8JSnc', description: 'Modern CSS layout techniques' },
    { title: 'JavaScript ES6+ Features', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=NCwa_xi0Uuc', description: 'Arrow functions, destructuring, modules' },
    { title: 'TypeScript for Beginners', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=BwuLxPH8IDs', description: 'TypeScript fundamentals and best practices' },
    { title: 'Authentication with JWT', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=mbsmsi7l3r4', description: 'JWT authentication in web apps' },
    { title: 'REST vs GraphQL', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=PeAOEAmR0D0', description: 'Comparing API architectures' },
    { title: 'Web Dev Roadmap 2024', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/web-development-roadmap/', description: 'Complete learning path for web development' },
    { title: 'Responsive Web Design', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/responsive-web-design/', description: 'Building responsive websites' },
  ],
  'SQL & Databases': [
    { title: 'SQL for Data Science', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=27axs9dO7AE', description: 'SQL fundamentals for analytics' },
    { title: 'Advanced SQL Queries', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=2Fn0WAyZV0E', description: 'Window functions, CTEs, subqueries' },
    { title: 'PostgreSQL Tutorial', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=qw--VYLpxG4', description: 'PostgreSQL from scratch' },
    { title: 'MongoDB CRUD Operations', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=J6mDkcqU_ZE', description: 'Working with MongoDB documents' },
    { title: 'Database Design Tutorial', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=ztHopE5Wnpc', description: 'Proper database schema design' },
    { title: 'SQL Practice Problems', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/sql-exercises/', description: '100 SQL practice exercises' },
    { title: 'Stored Procedures Guide', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/what-is-stored-procedures-in-sql/', description: 'Creating and using stored procedures' },
    { title: 'SQL vs NoSQL Comparison', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/difference-between-sql-and-nosql/', description: 'When to choose which database type' },
  ],
  'Aptitude & Reasoning': [
    { title: 'Quantitative Aptitude - RS Aggarwal', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=gMqNWjJD-a0', description: 'Complete aptitude course for placements' },
    { title: 'Logical Reasoning Tricks', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=RUgmvWGC5G4', description: 'Speed tricks for reasoning questions' },
    { title: 'Percentages & Profit Loss', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=5sEEU-YVpIw', description: 'Percentage problems made easy' },
    { title: 'Time Speed Distance', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=_JpyBu-r_Gc', description: 'All TSD problem types covered' },
    { title: 'Probability Problems', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=uzkc-qNVoOk', description: 'Probability for competitive exams' },
    { title: 'Number Series Patterns', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=z4NtMIK8P5A', description: 'Finding patterns in number sequences' },
    { title: 'Blood Relations', resourceType: 'article', level: 'beginner', link: 'https://www.geeksforgeeks.org/blood-relation-reasoning/', description: 'Solving blood relation puzzles' },
    { title: 'Seating Arrangement', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/seating-arrangement/', description: 'Linear and circular arrangement problems' },
    { title: 'Data Interpretation', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/data-interpretation/', description: 'Bar graphs, pie charts, tables' },
  ],
  'Java Programming': [
    { title: 'Java Full Course', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=grEKMHGYyns', description: 'Complete Java programming tutorial' },
    { title: 'Java Collections Framework', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=rzA7UJ-hQn4', description: 'ArrayList, HashMap, TreeSet explained' },
    { title: 'Multithreading in Java', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=r_MbozD32eo', description: 'Threads, synchronization, executors' },
    { title: 'Java Streams & Lambda', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=Q93JsQ8vcwY', description: 'Functional programming in Java 8+' },
    { title: 'Spring Boot Tutorial', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=9SGDpanrc8U', description: 'Building REST APIs with Spring Boot' },
    { title: 'JVM Architecture', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=QHIWkwxs0AI', description: 'How Java Virtual Machine works' },
    { title: 'Exception Handling', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=1XAfapkBQjk', description: 'Try-catch, custom exceptions' },
    { title: 'Java Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/java-interview-questions/', description: 'Top 100 Java interview questions' },
    { title: 'Garbage Collection in Java', resourceType: 'article', level: 'advanced', link: 'https://www.geeksforgeeks.org/garbage-collection-java/', description: 'GC algorithms and tuning' },
  ],
  'Python Programming': [
    { title: 'Python Full Course', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc', description: 'Python for absolute beginners' },
    { title: 'Python Data Structures', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=pkYVOmU3MgA', description: 'Lists, dicts, sets, tuples deep dive' },
    { title: 'Python OOP Tutorial', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=ZDa-Z5JzLYM', description: 'Object-oriented programming in Python' },
    { title: 'Django Full Course', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=PtQiiknWUcI', description: 'Building web apps with Django' },
    { title: 'Flask REST API', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=qbLc5a9jdXo', description: 'RESTful APIs with Flask' },
    { title: 'Python Decorators', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=FsAPt_9Bf3U', description: 'Understanding decorators and closures' },
    { title: 'NumPy & Pandas Basics', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=QUT1VHiLmmI', description: 'Data manipulation with NumPy and Pandas' },
    { title: 'Python Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/python-interview-questions/', description: 'Top Python interview questions' },
  ],
  'C/C++ Programming': [
    { title: 'C Programming Full Course', resourceType: 'video', level: 'beginner', link: 'https://www.youtube.com/watch?v=87SH2Cn0s9A', description: 'Complete C programming tutorial' },
    { title: 'C++ STL Tutorial', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=RRVYpIET_RU', description: 'Standard Template Library: vectors, maps, sets' },
    { title: 'Pointers in C/C++', resourceType: 'video', level: 'intermediate', link: 'https://www.youtube.com/watch?v=zuegQmMdy8M', description: 'Understanding pointers step by step' },
    { title: 'Memory Management in C++', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=7E7n6MxZ5Oo', description: 'Stack vs heap, new/delete, smart pointers' },
    { title: 'Templates in C++', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=I-hZkUa9mIs', description: 'Function and class templates' },
    { title: 'Competitive Programming in C++', resourceType: 'video', level: 'advanced', link: 'https://www.youtube.com/watch?v=nqowUJzG-iM', description: 'CP techniques and tricks' },
    { title: 'C++ Interview Questions', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/cpp-interview-questions/', description: 'Most asked C++ questions in interviews' },
    { title: 'Dynamic Memory Allocation', resourceType: 'article', level: 'intermediate', link: 'https://www.geeksforgeeks.org/dynamic-memory-allocation-in-c-using-malloc-calloc-free-and-realloc/', description: 'malloc, calloc, realloc, free explained' },
  ],
};

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📡 Connected to MongoDB');

    // Clear existing data
    await Topic.deleteMany({});
    await Resource.deleteMany({});
    console.log('🗑️ Cleared existing topics and resources');

    let totalResources = 0;

    for (const topicData of topicsData) {
      const topic = await Topic.create(topicData);
      console.log(`✅ Created topic: ${topic.name}`);

      const resources = resourceSets[topicData.name] || [];
      for (const res of resources) {
        await Resource.create({
          ...res,
          topic: topic._id,
          uploadedBy: new mongoose.Types.ObjectId()
        });
        totalResources++;
      }
      console.log(`   📚 Added ${resources.length} resources`);
    }

    console.log(`\n🎉 Seeding complete! ${topicsData.length} topics, ${totalResources} resources`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seed();
