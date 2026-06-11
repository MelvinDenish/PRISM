const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Models
const User = require('../models/User');
const Company = require('../models/Company');
const Topic = require('../models/Topic');
const Resource = require('../models/Resource');
const Progress = require('../models/Progress');
const MentorshipSession = require('../models/MentorshipSession');
const MockInterview = require('../models/MockInterview');
const CodingQuestion = require('../models/CodingQuestion');
const MockFeedback = require('../models/MockFeedback');
const GDRoom = require('../models/GDRoom');
const Notification = require('../models/Notification');
const Availability = require('../models/Availability');
const InterviewGame = require('../models/InterviewGame');
const LearningPath = require('../models/LearningPath');
const CodeSubmission = require('../models/CodeSubmission');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const ResumeDraft = require('../models/ResumeDraft');
const authoredCoding = require('./data/codingProblems');
const { verifyProblem } = require('../utils/codingGrader');

const seedAll = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔗 Connected to MongoDB');

        // ── Clear all collections ──
        console.log('🗑️  Clearing existing data...');
        await Promise.all([
            User.deleteMany({}), Company.deleteMany({}), Topic.deleteMany({}),
            Resource.deleteMany({}), Progress.deleteMany({}), MentorshipSession.deleteMany({}),
            MockInterview.deleteMany({}), CodingQuestion.deleteMany({}), MockFeedback.deleteMany({}),
            GDRoom.deleteMany({}), Notification.deleteMany({}), Availability.deleteMany({}),
            InterviewGame.deleteMany({}), LearningPath.deleteMany({}), CodeSubmission.deleteMany({}),
            ResumeAnalysis.deleteMany({}), ResumeDraft.deleteMany({})
        ]);

        const hash = await bcrypt.hash('password123', 10);

        // ════════════════════════════════════════
        // 1. USERS (5 mentors, 15 mentees, 1 admin)
        // ════════════════════════════════════════
        console.log('👥 Seeding users...');
        const mentorData = [
            { name: 'Rahul Sharma', email: 'rahul.mentor@prism.dev', password: hash, role: 'mentor', expertise: ['Data Structures', 'Algorithms', 'System Design'], currentCompany: 'Google', experience: 8, bio: 'Senior SWE at Google. Passionate about DSA & system design mentoring.', linkedin: 'https://linkedin.com/in/rahulsharma', github: 'https://github.com/rahulsharma', isOnline: true, rating: 4.8, totalReviews: 42 },
            { name: 'Priya Patel', email: 'priya.mentor@prism.dev', password: hash, role: 'mentor', expertise: ['Web Development', 'React', 'Node.js', 'DBMS'], currentCompany: 'Microsoft', experience: 6, bio: 'Full-stack dev at Microsoft. Specializes in web & database tech.', linkedin: 'https://linkedin.com/in/priyapatel', github: 'https://github.com/priyapatel', isOnline: true, rating: 4.6, totalReviews: 35 },
            { name: 'Arjun Reddy', email: 'arjun.mentor@prism.dev', password: hash, role: 'mentor', expertise: ['Competitive Programming', 'Algorithms', 'OS', 'Computer Networks'], currentCompany: 'Amazon', experience: 5, bio: 'SDE-2 at Amazon. Codeforces 2100+. Expert in OS & CN concepts.', linkedin: 'https://linkedin.com/in/arjunreddy', github: 'https://github.com/arjunreddy', isOnline: false, rating: 4.9, totalReviews: 28 },
            { name: 'Sneha Iyer', email: 'sneha.mentor@prism.dev', password: hash, role: 'mentor', expertise: ['Machine Learning', 'Python', 'Data Science', 'OOP'], currentCompany: 'Meta', experience: 7, bio: 'ML Engineer at Meta. PhD from IIT Bombay.', linkedin: 'https://linkedin.com/in/snehaiyer', github: 'https://github.com/snehaiyer', isOnline: true, rating: 4.7, totalReviews: 31 },
            { name: 'Vikram Singh', email: 'vikram.mentor@prism.dev', password: hash, role: 'mentor', expertise: ['System Design', 'Backend', 'Java', 'Microservices'], currentCompany: 'Flipkart', experience: 10, bio: 'Principal Engineer at Flipkart. 10 years scaling backend systems.', linkedin: 'https://linkedin.com/in/vikramsingh', github: 'https://github.com/vikramsingh', isOnline: false, rating: 4.9, totalReviews: 55 },
        ];
        const menteeData = [
            { name: 'Aditya Kumar', email: 'aditya@prism.dev', password: hash, role: 'mentee', bio: '3rd year CSE at NIT Trichy. Preparing for placements.', college: 'NIT Trichy', graduationYear: 2025, skills: ['Java', 'DSA', 'SQL'], aimingCompany: 'Google' },
            { name: 'Kavya Nair', email: 'kavya@prism.dev', password: hash, role: 'mentee', bio: 'Final year IT at VIT Vellore. Web dev & AI/ML enthusiast.', college: 'VIT Vellore', graduationYear: 2025, skills: ['Python', 'React', 'ML'], aimingCompany: 'Microsoft' },
            { name: 'Rohit Gupta', email: 'rohit@prism.dev', password: hash, role: 'mentee', bio: '4th year CSE at BITS Pilani. 500+ LeetCode problems.', college: 'BITS Pilani', graduationYear: 2025, skills: ['C++', 'Algorithms', 'System Design'], aimingCompany: 'Amazon' },
            { name: 'Ananya Mehta', email: 'ananya@prism.dev', password: hash, role: 'mentee', bio: '3rd year ECE transitioning to SWE. Focused on DSA.', college: 'IIIT Hyderabad', graduationYear: 2026, skills: ['Python', 'Data Structures', 'JavaScript'], aimingCompany: 'Google' },
            { name: 'Siddharth Jain', email: 'siddharth@prism.dev', password: hash, role: 'mentee', bio: 'Final year CSE at DTU. Preparing for SDE roles.', college: 'DTU', graduationYear: 2025, skills: ['Java', 'Spring Boot', 'React'], aimingCompany: 'Flipkart' },
            { name: 'Meera Krishnan', email: 'meera@prism.dev', password: hash, role: 'mentee', bio: '3rd year CSE at IIT Madras. CP enthusiast.', college: 'IIT Madras', graduationYear: 2026, skills: ['C++', 'Python', 'Algorithms'], aimingCompany: 'Google' },
            { name: 'Aryan Thakur', email: 'aryan@prism.dev', password: hash, role: 'mentee', bio: 'Final year IT at NSUT. Full-stack developer.', college: 'NSUT', graduationYear: 2025, skills: ['JavaScript', 'Node.js', 'MongoDB'], aimingCompany: 'Microsoft' },
            { name: 'Divya Sharma', email: 'divya@prism.dev', password: hash, role: 'mentee', bio: '3rd year CSE at PES University. Exploring backend dev.', college: 'PES University', graduationYear: 2026, skills: ['Java', 'MySQL', 'REST APIs'], aimingCompany: 'Amazon' },
            { name: 'Karthik Rajan', email: 'karthik@prism.dev', password: hash, role: 'mentee', bio: '4th year CSE at NIT Surathkal. Aspiring ML engineer.', college: 'NIT Surathkal', graduationYear: 2025, skills: ['Python', 'TensorFlow', 'SQL'], aimingCompany: 'Meta' },
            { name: 'Nisha Patel', email: 'nisha@prism.dev', password: hash, role: 'mentee', bio: 'Final year IT at COEP Pune. Mobile & web developer.', college: 'COEP Pune', graduationYear: 2025, skills: ['React Native', 'JavaScript', 'Firebase'], aimingCompany: 'Flipkart' },
            { name: 'Tanmay Desai', email: 'tanmay@prism.dev', password: hash, role: 'mentee', bio: '3rd year CSE at RVCE. DevOps & cloud computing interest.', college: 'RVCE Bangalore', graduationYear: 2026, skills: ['Docker', 'AWS', 'Python'], aimingCompany: 'Amazon' },
            { name: 'Shruti Bose', email: 'shruti@prism.dev', password: hash, role: 'mentee', bio: '4th year CSE at Jadavpur University. NLP researcher.', college: 'Jadavpur University', graduationYear: 2025, skills: ['Python', 'NLP', 'PyTorch'], aimingCompany: 'Google' },
            { name: 'Varun Malhotra', email: 'varun@prism.dev', password: hash, role: 'mentee', bio: 'Final year CSE at MNNIT Allahabad. Systems programmer.', college: 'MNNIT Allahabad', graduationYear: 2025, skills: ['C', 'C++', 'Linux', 'OS'], aimingCompany: 'Microsoft' },
            { name: 'Ishita Verma', email: 'ishita@prism.dev', password: hash, role: 'mentee', bio: '3rd year IT at IIIT Delhi. Cybersecurity & web dev.', college: 'IIIT Delhi', graduationYear: 2026, skills: ['JavaScript', 'React', 'Node.js'], aimingCompany: 'Flipkart' },
            { name: 'Pranav Kulkarni', email: 'pranav@prism.dev', password: hash, role: 'mentee', bio: '4th year CSE at VJTI Mumbai. Database systems interest.', college: 'VJTI Mumbai', graduationYear: 2025, skills: ['SQL', 'Java', 'Data Modeling'], aimingCompany: 'Oracle' },
        ];
        const adminData = { name: 'PRISM Admin', email: 'admin@prism.dev', password: hash, role: 'admin', bio: 'Platform administrator' };

        const mentors = await User.insertMany(mentorData);
        const mentees = await User.insertMany(menteeData);
        const admin = await User.create(adminData);
        console.log(`   ✅ ${mentors.length} mentors, ${mentees.length} mentees, 1 admin`);

        // ════════════════════════════════════════
        // 2. COMPANIES
        // ════════════════════════════════════════
        console.log('🏢 Seeding companies...');
        const companies = await Company.insertMany([
            { name: 'Google', description: 'Tech giant known for search, cloud, and AI. Strong focus on DSA and system design in interviews.', interviewPattern: '2 Phone Screens → Onsite (4-5 rounds: Coding, System Design, Behavioral)', difficultyLevel: 'Hard' },
            { name: 'Microsoft', description: 'Largest software company. Interviews test problem-solving, coding, and design skills.', interviewPattern: 'OA → 3-4 Onsite Rounds (Coding, Design, Behavioral)', difficultyLevel: 'Medium-Hard' },
            { name: 'Amazon', description: 'E-commerce & cloud leader. Focus on Leadership Principles and scalable system design.', interviewPattern: 'OA → Phone Screen → 4-5 Loop Interviews (LP + Coding + Design)', difficultyLevel: 'Hard' },
            { name: 'Meta', description: 'Social media & VR company. Strong emphasis on coding speed and system design.', interviewPattern: 'Recruiter Call → 2 Coding → 1 System Design → 1 Behavioral', difficultyLevel: 'Hard' },
            { name: 'Flipkart', description: 'India\'s leading e-commerce platform. Interviews focus on DSA, machine coding, and HLD.', interviewPattern: 'OA → Machine Coding → DSA → System Design → HR', difficultyLevel: 'Medium-Hard' },
            { name: 'Apple', description: 'Hardware & software innovator. Domain-specific interviews with deep technical depth.', interviewPattern: 'Phone Screen → Team Interviews (4-6 rounds, domain-specific)', difficultyLevel: 'Hard' },
            { name: 'Netflix', description: 'Streaming platform known for culture of excellence. Senior-level focused interviews.', interviewPattern: 'Recruiter → Phone Screen → Onsite (Culture, Technical, System Design)', difficultyLevel: 'Hard' },
            { name: 'Adobe', description: 'Creative software giant. Focus on problem-solving and OOP design.', interviewPattern: 'OA → Technical Rounds (3) → Managerial → HR', difficultyLevel: 'Medium' },
            { name: 'Oracle', description: 'Enterprise database & cloud. Strong SQL and system-level knowledge expected.', interviewPattern: 'OA → 2-3 Technical → HR', difficultyLevel: 'Medium' },
            { name: 'Uber', description: 'Ride-sharing technology company. Real-world system design problems.', interviewPattern: 'Phone Screen → 2 Coding → 1 System Design → 1 Behavioral', difficultyLevel: 'Hard' },
            { name: 'Goldman Sachs', description: 'Investment banking tech. Focus on DSA, aptitude, and problem solving.', interviewPattern: 'OA (Aptitude + Coding) → Technical (2-3) → HR', difficultyLevel: 'Medium-Hard' },
            { name: 'Infosys', description: 'IT services leader. Focuses on aptitude, coding basics, and communication.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium' },
            { name: 'TCS', description: 'India\'s largest IT services company. Campus hiring through NQT exam.', interviewPattern: 'NQT Exam → Technical → Managerial → HR', difficultyLevel: 'Easy' },
            { name: 'Wipro', description: 'Global IT services. Tests coding, aptitude, and domain knowledge.', interviewPattern: 'OA → Technical → HR', difficultyLevel: 'Easy-Medium' },
            { name: 'Deloitte', description: 'Big Four consulting firm. Mix of technical and case study interviews.', interviewPattern: 'OA → Group Discussion → Technical → Case Study → HR', difficultyLevel: 'Medium' },
        ]);
        console.log(`   ✅ ${companies.length} companies`);

        // ════════════════════════════════════════
        // 3. TOPICS
        // ════════════════════════════════════════
        console.log('📚 Seeding topics...');
        const topicNames = [
            'Data Structures', 'Algorithms', 'System Design', 'Operating Systems',
            'Database Management', 'Computer Networks', 'Object Oriented Programming',
            'Web Development', 'Machine Learning', 'Dynamic Programming',
            'Graph Theory', 'String Algorithms', 'Binary Trees & BST',
            'Sorting & Searching', 'Recursion & Backtracking', 'Bit Manipulation',
            'Linked Lists', 'Stacks & Queues', 'Heap & Priority Queue', 'Greedy Algorithms',
            'Aptitude & Reasoning', 'HR & Behavioral'
        ];
        const topicDescriptions = [
            'Arrays, Linked Lists, Trees, Graphs, Hash Maps, Heaps',
            'Sorting, Searching, Divide & Conquer, Greedy, DP',
            'HLD, LLD, Microservices, Load Balancing, Caching',
            'Processes, Threads, Scheduling, Memory Management, Deadlocks',
            'SQL, NoSQL, Normalization, Indexing, Transactions',
            'TCP/IP, HTTP, DNS, OSI Model, Network Security',
            'Encapsulation, Inheritance, Polymorphism, SOLID Principles',
            'HTML, CSS, JavaScript, React, Node.js, REST APIs',
            'Supervised, Unsupervised, Neural Networks, NLP, CV',
            'Memoization, Tabulation, Knapsack, LCS, Matrix Chain',
            'BFS, DFS, Dijkstra, Bellman-Ford, Topological Sort',
            'KMP, Rabin-Karp, Trie, Suffix Array, Pattern Matching',
            'Traversals, BST operations, AVL, Red-Black, Segment Trees',
            'Binary Search, Merge Sort, Quick Sort, Counting Sort',
            'N-Queens, Sudoku Solver, Permutations, Combinations',
            'XOR tricks, Bit masking, Power of 2, Count set bits',
            'Singly, Doubly, Circular, Floyd\'s Cycle Detection',
            'Implementation, Monotonic Stack, Deque, Expression Evaluation',
            'Min/Max Heap, K-th element problems, Merge K lists',
            'Activity Selection, Huffman, Job Sequencing, Fractional Knapsack',
            'Quantitative Aptitude, Logical & Verbal Reasoning',
            'HR rounds, Behavioral questions, STAR method'
        ];
        const topics = await Topic.insertMany(
            topicNames.map((name, i) => ({ name, description: topicDescriptions[i], createdBy: admin._id }))
        );
        console.log(`   ✅ ${topics.length} topics`);

        // ════════════════════════════════════════
        // 4. RESOURCES (100+)
        // ════════════════════════════════════════
        console.log('📖 Seeding resources...');
        const levels = ['beginner', 'intermediate', 'advanced']; // used by later sections too
        const { CATALOG, inferType } = require('./data/resources');
        const topicByName = Object.fromEntries(topics.map((t) => [t.name, t]));
        const resourceEntries = [];
        let ri = 0;
        for (const [topicName, items] of Object.entries(CATALOG)) {
            const topic = topicByName[topicName];
            if (!topic) {
                console.warn(`   ⚠️  Skipping resources for unknown topic "${topicName}"`);
                continue;
            }
            for (const [title, link, level] of items) {
                resourceEntries.push({
                    title,
                    description: `${topic.name} — curated resource (${level}).`,
                    topic: topic._id,
                    level,
                    resourceType: inferType(link),
                    link,
                    uploadedBy: mentors[ri % mentors.length]._id,
                    companyTag: companies[ri % companies.length]._id
                });
                ri++;
            }
        }
        const resources = await Resource.insertMany(resourceEntries);
        console.log(`   ✅ ${resources.length} resources`);

        // ════════════════════════════════════════
        // 5. CODING QUESTIONS (30+)
        // ════════════════════════════════════════
        console.log('💻 Seeding coding questions...');
        // Unified, gradeable coding-practice bank (C2). Each authored problem ships
        // a Python reference solution; we run it here (verifyProblem) to produce
        // verified expected outputs — A7-safe, never hand-typed — so the standalone
        // /coding-questions page can grade submissions and track solved state.
        // Verification runs each problem's reference through executeCode, which
        // REFUSES local execution under NODE_ENV=production with no Judge0 — every
        // reference would then fail and zero problems would seed, silently. Warn loudly.
        if (process.env.NODE_ENV === 'production' && !process.env.JUDGE0_API_URL) {
            console.warn('   ⚠️  NODE_ENV=production with no JUDGE0_API_URL: coding-problem verification will fail and seed 0 problems. Seed with a non-production env or configure Judge0.');
        }
        const codingDocs = [];
        for (let i = 0; i < authoredCoding.length; i++) {
            const p = authoredCoding[i];
            const { testCases, verified, reason } = await verifyProblem(p);
            if (!verified) {
                console.warn(`   ⚠️  Skipped unverified coding problem "${p.title}": ${reason || 'verification failed'}`);
                continue;
            }
            codingDocs.push({
                title: p.title,
                description: p.description,
                difficulty: p.difficulty,
                category: p.category,
                topic: (topicByName[p.topicName] || topicByName['Data Structures'] || topics[0])._id,
                companyTags: [companies[i % companies.length]._id, companies[(i + 3) % companies.length]._id],
                examples: p.examples || [],
                testCases,
                boilerplate: p.boilerplate,
                referenceSolution: p.reference,
                verified: true,
                sampleInput: p.examples?.[0]?.input || '',
                sampleOutput: p.examples?.[0]?.output || '',
            });
        }
        const codingQuestions = await CodingQuestion.insertMany(codingDocs);
        console.log(`   ✅ ${codingQuestions.length} coding questions (verified, gradeable)`);

        // ════════════════════════════════════════
        // 6. PROGRESS for each mentee
        // ════════════════════════════════════════
        console.log('📊 Seeding progress...');
        const progressEntries = mentees.map((mentee, i) => ({
            mentee: mentee._id,
            completedResources: resources.slice(0, (i + 1) * 3).map(r => r._id),
            mockInterviewStats: {
                technicalScoreAvg: 60 + Math.floor(Math.random() * 30),
                hrScoreAvg: 65 + Math.floor(Math.random() * 30),
                gdScoreAvg: 55 + Math.floor(Math.random() * 35)
            },
            topicProgress: topics.slice(0, 5).map(t => ({
                topic: t._id,
                percentage: 10 + Math.floor(Math.random() * 80)
            }))
        }));
        await Progress.insertMany(progressEntries);
        console.log(`   ✅ ${progressEntries.length} progress records`);

        // ════════════════════════════════════════
        // 7. MENTORSHIP SESSIONS
        // ════════════════════════════════════════
        console.log('🤝 Seeding mentorship sessions...');
        const sessionStatuses = ['pending', 'approved', 'completed', 'completed', 'completed'];
        const sessionEntries = [];
        for (let i = 0; i < 25; i++) {
            const mentor = mentors[i % mentors.length];
            const mentee = mentees[i % mentees.length];
            const daysOffset = -30 + (i * 3);
            const status = sessionStatuses[i % sessionStatuses.length];
            sessionEntries.push({
                mentor: mentor._id,
                mentee: mentee._id,
                aimingCompany: companies[i % companies.length]._id,
                agenda: ['DSA Problem Solving', 'System Design Practice', 'Resume Review', 'Mock Interview Prep', 'Behavioral Questions'][i % 5],
                scheduledDate: new Date(Date.now() + daysOffset * 86400000),
                duration: [30, 45, 60][i % 3],
                meetingLink: `https://meet.google.com/prism-session-${i + 1}`,
                status,
                mentorFeedback: status === 'completed' ? 'Great session! Good progress on fundamentals. Focus more on optimization.' : undefined,
                menteeFeedback: status === 'completed' ? 'Very helpful session. Learned a lot about the approach to problems.' : undefined,
                ratingGiven: status === 'completed' ? 4 + Math.round(Math.random()) : undefined
            });
        }
        const sessions = await MentorshipSession.insertMany(sessionEntries);
        console.log(`   ✅ ${sessions.length} mentorship sessions`);

        // ════════════════════════════════════════
        // 8. MOCK INTERVIEWS
        // ════════════════════════════════════════
        console.log('🎤 Seeding mock interviews...');
        const mockTypes = ['technical', 'hr', 'gd'];
        const mockStatuses = ['scheduled', 'completed', 'completed'];
        const mockEntries = [];
        for (let i = 0; i < 20; i++) {
            const participantSlice = mentees.slice((i * 2) % mentees.length, ((i * 2) % mentees.length) + 3);
            mockEntries.push({
                type: mockTypes[i % 3],
                mentor: mentors[i % mentors.length]._id,
                participants: participantSlice.map(m => m._id),
                companyFocus: companies[i % companies.length]._id,
                topic: topics[i % topics.length]._id,
                scheduledDate: new Date(Date.now() + (-15 + i * 2) * 86400000),
                duration: [45, 60, 30][i % 3],
                meetingLink: `https://meet.google.com/prism-mock-${i + 1}`,
                status: mockStatuses[i % 3]
            });
        }
        const mockInterviews = await MockInterview.insertMany(mockEntries);
        console.log(`   ✅ ${mockInterviews.length} mock interviews`);

        // ════════════════════════════════════════
        // 9. MOCK FEEDBACK
        // ════════════════════════════════════════
        console.log('📝 Seeding mock feedback...');
        const feedbackEntries = [];
        const completedMocks = mockInterviews.filter(m => m.status === 'completed');
        for (const mock of completedMocks) {
            for (const participantId of mock.participants) {
                feedbackEntries.push({
                    mockInterview: mock._id,
                    user: participantId,
                    communicationScore: 6 + Math.floor(Math.random() * 4),
                    technicalScore: 5 + Math.floor(Math.random() * 5),
                    confidenceScore: 6 + Math.floor(Math.random() * 4),
                    problemSolvingScore: 5 + Math.floor(Math.random() * 5),
                    overallScore: 6 + Math.floor(Math.random() * 4),
                    strengths: ['Good communication skills', 'Strong problem-solving approach', 'Clear thought process', 'Good time management'][Math.floor(Math.random() * 4)],
                    weaknesses: ['Needs to improve edge case handling', 'Should practice more complex problems', 'Time complexity analysis needs work', 'Could explain approach more clearly'][Math.floor(Math.random() * 4)],
                    suggestions: ['Practice 2-3 medium problems daily on LeetCode', 'Study system design patterns', 'Work on behavioral question frameworks', 'Review core CS fundamentals'][Math.floor(Math.random() * 4)]
                });
            }
        }
        if (feedbackEntries.length) await MockFeedback.insertMany(feedbackEntries);
        console.log(`   ✅ ${feedbackEntries.length} mock feedback records`);

        // ════════════════════════════════════════
        // 10. GD ROOMS
        // ════════════════════════════════════════
        console.log('💬 Seeding GD rooms...');
        const gdTopics = [
            'Is AI a threat to jobs?', 'Remote work vs Office work',
            'Should coding be mandatory in schools?', 'Tech startups vs Corporate jobs',
            'Ethical implications of social media', 'Future of blockchain technology',
            'Impact of automation on developing countries', 'Open source vs Proprietary software'
        ];
        const gdEntries = gdTopics.map((gt, i) => ({
            topic: topics[i % topics.length]._id,
            participants: mentees.slice(i % 5, (i % 5) + 4).map(m => m._id),
            maxParticipants: 6,
            status: ['waiting', 'active', 'completed'][i % 3],
            gdTopic: gt
        }));
        await GDRoom.insertMany(gdEntries);
        console.log(`   ✅ ${gdEntries.length} GD rooms`);

        // ════════════════════════════════════════
        // 11. AVAILABILITY (for mentors)
        // ════════════════════════════════════════
        console.log('📅 Seeding availability...');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availEntries = mentors.map((mentor, mi) => ({
            mentor: mentor._id,
            weeklySlots: days.slice(0, 4 + (mi % 3)).map((day, di) => ({
                day,
                startTime: `${9 + di}:00`,
                endTime: `${10 + di}:00`,
                isAvailable: true
            })),
            availableSlots: Array.from({ length: 5 }, (_, si) => ({
                date: new Date(Date.now() + (si + 1) * 86400000),
                startTime: '10:00',
                endTime: '11:00',
                isBooked: si < 2,
                bookedBy: si < 2 ? mentees[si]._id : undefined
            })),
            timezone: 'Asia/Kolkata'
        }));
        await Availability.insertMany(availEntries);
        console.log(`   ✅ ${availEntries.length} availability records`);

        // ════════════════════════════════════════
        // 12. INTERVIEW GAMES
        // ════════════════════════════════════════
        console.log('🎮 Seeding interview games...');
        const roundTypes = ['aptitude', 'technical1', 'coding', 'gd', 'technical2', 'hr'];
        const gameEntries = [];
        for (let i = 0; i < 10; i++) {
            const roundCount = 3 + (i % 4);
            gameEntries.push({
                user: mentees[i % mentees.length]._id,
                rounds: roundTypes.slice(0, roundCount).map((type, ri) => ({
                    type,
                    score: 50 + Math.floor(Math.random() * 50),
                    maxScore: 100,
                    status: ri < roundCount - 1 ? 'completed' : 'pending',
                    feedback: ri < roundCount - 1 ? 'Good performance. Keep practicing!' : undefined,
                    completedAt: ri < roundCount - 1 ? new Date(Date.now() - (roundCount - ri) * 3600000) : undefined
                })),
                currentRound: roundCount - 1,
                totalScore: 0,
                status: i < 6 ? 'completed' : 'in-progress',
                difficulty: ['easy', 'medium', 'hard'][i % 3],
                companyFocus: companies[i % companies.length]._id,
                completedAt: i < 6 ? new Date() : undefined
            });
        }
        // Calculate total scores
        gameEntries.forEach(g => { g.totalScore = g.rounds.reduce((s, r) => s + r.score, 0); });
        await InterviewGame.insertMany(gameEntries);
        console.log(`   ✅ ${gameEntries.length} interview games`);

        // ════════════════════════════════════════
        // 13. NOTIFICATIONS
        // ════════════════════════════════════════
        console.log('🔔 Seeding notifications...');
        const notifEntries = [];
        for (let i = 0; i < mentees.length; i++) {
            notifEntries.push(
                { user: mentees[i]._id, message: `Welcome to PRISM! Start your placement journey today.`, type: 'general', isRead: true },
                { user: mentees[i]._id, message: `New resource added: "${resources[i % resources.length].title}"`, type: 'resource', isRead: i % 2 === 0 },
                { user: mentees[i]._id, message: `Your mentorship session has been ${i % 2 === 0 ? 'approved' : 'scheduled'}!`, type: 'session', isRead: false },
                { user: mentees[i]._id, message: `Mock interview reminder: ${mockTypes[i % 3]} interview tomorrow.`, type: 'mock', isRead: false }
            );
        }
        await Notification.insertMany(notifEntries);
        console.log(`   ✅ ${notifEntries.length} notifications`);

        // ════════════════════════════════════════
        // 14. LEARNING PATHS
        // ════════════════════════════════════════
        console.log('🛤️  Seeding learning paths...');
        const lpEntries = [];
        for (let i = 0; i < 8; i++) {
            const topicIdx = i % topics.length;
            const stepCount = 5 + (i % 3);
            const completedCount = Math.floor(stepCount * (Math.random() * 0.6));
            lpEntries.push({
                user: mentees[i % mentees.length]._id,
                topic: topics[topicIdx]._id,
                title: `Master ${topics[topicIdx].name}`,
                description: `A structured path to master ${topics[topicIdx].name} from basics to advanced.`,
                level: levels[i % 3],
                steps: Array.from({ length: stepCount }, (_, si) => ({
                    order: si + 1,
                    title: `Step ${si + 1}: ${['Introduction', 'Core Concepts', 'Practice Problems', 'Advanced Topics', 'Mock Test', 'Final Review', 'Expert Level'][si % 7]}`,
                    description: `Learn and practice ${topics[topicIdx].name} - Part ${si + 1}`,
                    resourceTitle: resources[(i * stepCount + si) % resources.length].title,
                    resourceLink: resources[(i * stepCount + si) % resources.length].link,
                    estimatedTime: `${1 + si}h`,
                    completed: si < completedCount,
                    completedAt: si < completedCount ? new Date(Date.now() - (stepCount - si) * 86400000) : undefined
                })),
                totalSteps: stepCount,
                completedSteps: completedCount,
                progress: Math.round((completedCount / stepCount) * 100),
                aiGenerated: i % 2 === 0
            });
        }
        await LearningPath.insertMany(lpEntries);
        console.log(`   ✅ ${lpEntries.length} learning paths`);

        // ════════════════════════════════════════
        // 15. RESUME ANALYSES
        // ════════════════════════════════════════
        console.log('📄 Seeding resume analyses...');
        const raEntries = mentees.slice(0, 8).map((mentee, i) => ({
            user: mentee._id,
            jobDescription: ['Frontend Developer at Google', 'SDE at Amazon', 'ML Engineer at Meta', 'Backend Dev at Microsoft', 'Full Stack at Flipkart', 'Data Engineer at Uber', 'SWE at Apple', 'DevOps at Netflix'][i],
            matchScore: 55 + Math.floor(Math.random() * 35),
            missingKeywords: [['TypeScript', 'GraphQL', 'CI/CD'], ['AWS', 'Microservices', 'Kafka'], ['PyTorch', 'Computer Vision', 'MLOps'], ['C#', '.NET', 'Azure'], ['Next.js', 'PostgreSQL', 'Redis'], ['Spark', 'Airflow', 'ETL'], ['Swift', 'Objective-C', 'Metal'], ['Kubernetes', 'Terraform', 'Ansible']][i],
            suggestions: 'Add more quantifiable achievements. Include relevant projects with tech stack details. Highlight leadership and teamwork experiences.',
            redFlags: [['No GitHub profile linked'], ['Graduation year missing'], ['Objective statement too generic'], ['No internship experience listed']][i % 4],
            starSuggestions: ['Quantify your project impact with metrics', 'Add open-source contributions', 'Include relevant certifications']
        }));
        await ResumeAnalysis.insertMany(raEntries);
        console.log(`   ✅ ${raEntries.length} resume analyses`);

        // ════════════════════════════════════════
        // 16. RESUME DRAFTS
        // ════════════════════════════════════════
        console.log('📝 Seeding resume drafts...');
        const rdEntries = mentees.slice(0, 6).map((mentee, i) => ({
            user: mentee._id,
            name: `${mentee.name}'s Resume`,
            template: ['modern', 'classic', 'creative'][i % 3],
            personalInfo: {
                fullName: mentee.name,
                email: mentee.email,
                phone: `+91 98765${43210 + i}`,
                location: ['Chennai', 'Bangalore', 'Hyderabad', 'Mumbai', 'Delhi', 'Pune'][i],
                linkedin: `https://linkedin.com/in/${mentee.name.toLowerCase().replace(' ', '')}`,
                github: `https://github.com/${mentee.name.toLowerCase().replace(' ', '')}`,
                summary: `Passionate ${mentee.bio}`
            },
            education: [{
                institution: mentee.college || 'National Institute of Technology',
                degree: 'B.Tech',
                field: ['Computer Science', 'Information Technology', 'ECE'][i % 3],
                startDate: '2021',
                endDate: String(mentee.graduationYear || 2025),
                gpa: `${8 + (i % 2)}.${3 + i}`
            }],
            experience: i % 2 === 0 ? [{
                company: ['Google (Intern)', 'Microsoft (Intern)', 'Amazon (Intern)'][i % 3],
                position: 'Software Engineering Intern',
                startDate: 'May 2024',
                endDate: 'July 2024',
                current: false,
                description: 'Worked on core product features. Improved API performance by 30%. Collaborated with a team of 5 engineers.'
            }] : [],
            skills: mentee.skills || ['JavaScript', 'Python', 'SQL'],
            projects: [
                { name: 'E-Commerce Platform', description: 'Full-stack e-commerce with payment integration', technologies: 'React, Node.js, MongoDB, Stripe', link: 'https://github.com/project1' },
                { name: 'ML Sentiment Analyzer', description: 'NLP model for social media sentiment analysis', technologies: 'Python, TensorFlow, Flask', link: 'https://github.com/project2' }
            ],
            certifications: [
                { name: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', date: '2024' }
            ]
        }));
        await ResumeDraft.insertMany(rdEntries);
        console.log(`   ✅ ${rdEntries.length} resume drafts`);

        // ════════════════════════════════════════
        // DONE
        // ════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 ALL SEED DATA POPULATED SUCCESSFULLY!');
        console.log('═'.repeat(60));
        console.log('\n📋 Login Credentials (all passwords: password123):');
        console.log('━'.repeat(60));
        console.log('\n🟢 MENTORS:');
        mentorData.forEach(m => console.log(`   ${m.name.padEnd(22)} → ${m.email.padEnd(30)} (${m.currentCompany})`));
        console.log('\n🔵 MENTEES:');
        menteeData.forEach(m => console.log(`   ${m.name.padEnd(22)} → ${m.email}`));
        console.log('\n🔴 ADMIN:');
        console.log(`   ${adminData.name.padEnd(22)} → ${adminData.email}`);
        console.log('\n━'.repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`   Users: ${mentors.length + mentees.length + 1} | Companies: ${companies.length} | Topics: ${topics.length}`);
        console.log(`   Resources: ${resources.length} | Coding Questions: ${codingQuestions.length}`);
        console.log(`   Sessions: ${sessions.length} | Mock Interviews: ${mockInterviews.length}`);
        console.log(`   Feedback: ${feedbackEntries.length} | GD Rooms: ${gdEntries.length}`);
        console.log(`   Notifications: ${notifEntries.length} | Learning Paths: ${lpEntries.length}`);
        console.log(`   Resume Drafts: ${rdEntries.length} | Resume Analyses: ${raEntries.length}`);
        console.log(`   Interview Games: ${gameEntries.length} | Availability: ${availEntries.length}`);
        console.log('');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        process.exit(1);
    }
};

seedAll();
