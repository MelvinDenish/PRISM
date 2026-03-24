const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/prism');
        console.log('🔗 Connected to MongoDB');

        const hashedPassword = await bcrypt.hash('password123', 10);

        const mentors = [
            {
                name: 'Rahul Sharma',
                email: 'rahul.mentor@prism.dev',
                password: hashedPassword,
                role: 'mentor',
                expertise: ['Data Structures', 'Algorithms', 'System Design'],
                currentCompany: 'Google',
                experience: 8,
                bio: 'Senior Software Engineer at Google with 8 years of experience. Passionate about mentoring students in DSA and system design.',
                linkedin: 'https://linkedin.com/in/rahulsharma',
                github: 'https://github.com/rahulsharma',
                isOnline: true
            },
            {
                name: 'Priya Patel',
                email: 'priya.mentor@prism.dev',
                password: hashedPassword,
                role: 'mentor',
                expertise: ['Web Development', 'React', 'Node.js', 'DBMS'],
                currentCompany: 'Microsoft',
                experience: 6,
                bio: 'Full-stack developer at Microsoft. Specializes in web technologies and database management. Love helping students crack product-based company interviews.',
                linkedin: 'https://linkedin.com/in/priyapatel',
                github: 'https://github.com/priyapatel',
                isOnline: true
            },
            {
                name: 'Arjun Reddy',
                email: 'arjun.mentor@prism.dev',
                password: hashedPassword,
                role: 'mentor',
                expertise: ['Competitive Programming', 'Algorithms', 'OS', 'Computer Networks'],
                currentCompany: 'Amazon',
                experience: 5,
                bio: 'SDE-2 at Amazon. Ex-competitive programmer with a Codeforces rating of 2100+. Expert in OS and CN concepts.',
                linkedin: 'https://linkedin.com/in/arjunreddy',
                github: 'https://github.com/arjunreddy',
                isOnline: false
            },
            {
                name: 'Sneha Iyer',
                email: 'sneha.mentor@prism.dev',
                password: hashedPassword,
                role: 'mentor',
                expertise: ['Machine Learning', 'Python', 'Data Science', 'OOP'],
                currentCompany: 'Meta',
                experience: 7,
                bio: 'ML Engineer at Meta. PhD in CS from IIT Bombay. Helps students with coding interviews and ML concepts.',
                linkedin: 'https://linkedin.com/in/snehaiyer',
                github: 'https://github.com/snehaiyer',
                isOnline: true
            },
            {
                name: 'Vikram Singh',
                email: 'vikram.mentor@prism.dev',
                password: hashedPassword,
                role: 'mentor',
                expertise: ['System Design', 'Backend Development', 'Java', 'Microservices'],
                currentCompany: 'Flipkart',
                experience: 10,
                bio: 'Principal Engineer at Flipkart with 10 years of experience. Expert in system design and large-scale backend systems.',
                linkedin: 'https://linkedin.com/in/vikramsingh',
                github: 'https://github.com/vikramsingh',
                isOnline: false
            }
        ];

        const mentees = [
            {
                name: 'Aditya Kumar',
                email: 'aditya@prism.dev',
                password: hashedPassword,
                role: 'mentee',
                bio: '3rd year CSE student at NIT Trichy. Preparing for placements in product-based companies.',
                college: 'NIT Trichy',
                graduationYear: 2025
            },
            {
                name: 'Kavya Nair',
                email: 'kavya@prism.dev',
                password: hashedPassword,
                role: 'mentee',
                bio: 'Final year IT student at VIT Vellore. Interested in web development and AI/ML roles.',
                college: 'VIT Vellore',
                graduationYear: 2025
            },
            {
                name: 'Rohit Gupta',
                email: 'rohit@prism.dev',
                password: hashedPassword,
                role: 'mentee',
                bio: '4th year CSE student at BITS Pilani. Active on LeetCode with 500+ problems solved.',
                college: 'BITS Pilani',
                graduationYear: 2025
            },
            {
                name: 'Ananya Mehta',
                email: 'ananya@prism.dev',
                password: hashedPassword,
                role: 'mentee',
                bio: '3rd year ECE student transitioning to software roles. Focused on DSA and backend development.',
                college: 'IIIT Hyderabad',
                graduationYear: 2026
            },
            {
                name: 'Siddharth Jain',
                email: 'siddharth@prism.dev',
                password: hashedPassword,
                role: 'mentee',
                bio: 'Final year CSE student at DTU. Preparing for SDE roles at top tech companies.',
                college: 'DTU',
                graduationYear: 2025
            }
        ];

        const admin = {
            name: 'PRISM Admin',
            email: 'admin@prism.dev',
            password: hashedPassword,
            role: 'admin',
            bio: 'Platform administrator'
        };

        // Clear existing users (optional — comment out to keep existing)
        // await User.deleteMany({});

        // Upsert users by email
        for (const user of [...mentors, ...mentees, admin]) {
            await User.findOneAndUpdate(
                { email: user.email },
                user,
                { upsert: true, new: true }
            );
        }

        console.log('✅ Sample users seeded successfully!\n');
        console.log('📋 Login Credentials (all passwords: password123):');
        console.log('━'.repeat(55));
        console.log('MENTORS:');
        mentors.forEach(m => console.log(`  ${m.name.padEnd(20)} → ${m.email} (${m.currentCompany})`));
        console.log('\nMENTEES:');
        mentees.forEach(m => console.log(`  ${m.name.padEnd(20)} → ${m.email}`));
        console.log('\nADMIN:');
        console.log(`  ${admin.name.padEnd(20)} → ${admin.email}`);
        console.log('━'.repeat(55));

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error seeding users:', err);
        process.exit(1);
    }
};

seedUsers();
