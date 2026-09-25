require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/event-management';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  await Event.deleteMany({});
  await Registration.deleteMany({});

  const hashedPassword = await bcrypt.hash('TestPass123!', 10);

  const admin = await User.create({
    name: 'Test Admin',
    email: 'admin.test@example.com',
    password: hashedPassword,
    role: 'admin',
  });

  const organizer = await User.create({
    name: 'Test Organizer',
    email: 'organizer.test@example.com',
    password: hashedPassword,
    role: 'organizer',
  });

  const attendee = await User.create({
    name: 'Test Attendee',
    email: 'attendee.test@example.com',
    password: hashedPassword,
    role: 'attendee',
  });

  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);

  const pastDate = new Date();
  pastDate.setFullYear(pastDate.getFullYear() - 1);

  const events = await Event.create([
    {
      title: 'Burify Tech Summit',
      description: 'A premier technology conference bringing together innovators, developers, and tech enthusiasts.',
      category: 'Technology',
      date: futureDate,
      time: '09:00',
      location: 'Burify Labs',
      city: 'Nairobi',
      capacity: 100,
      price: 0,
      image: 'https://picsum.photos/seed/burify-tech/800/400',
      organizer: organizer._id,
      status: 'published',
      visibility: 'public',
    },
    {
      title: 'Burify Design Conference',
      description: 'Explore the latest in design thinking, UI/UX, and creative technologies.',
      category: 'Design',
      date: futureDate,
      time: '10:00',
      location: 'Conference Center',
      city: 'Nairobi',
      capacity: 250,
      price: 50,
      image: 'https://picsum.photos/seed/burify-design/800/400',
      organizer: organizer._id,
      status: 'published',
      visibility: 'public',
    },
    {
      title: 'Burify Private Workshop',
      description: 'An exclusive workshop for invited participants only.',
      category: 'Technology',
      date: futureDate,
      time: '13:00',
      location: 'Burify Labs',
      city: 'Nairobi',
      capacity: 20,
      price: 0,
      image: 'https://picsum.photos/seed/burify-private/800/400',
      organizer: organizer._id,
      status: 'published',
      visibility: 'private',
    },
    {
      title: 'Burify Draft Workshop',
      description: 'A draft event that is not yet ready for public viewing.',
      category: 'Business',
      date: futureDate,
      time: '14:00',
      location: 'Business Hub',
      city: 'Nairobi',
      capacity: 50,
      price: 0,
      image: 'https://picsum.photos/seed/burify-draft/800/400',
      organizer: organizer._id,
      status: 'draft',
      visibility: 'public',
    },
    {
      title: 'Burify Cancelled Conference',
      description: 'This event has been cancelled and should not appear in public listings.',
      category: 'Technology',
      date: futureDate,
      time: '11:00',
      location: 'Convention Center',
      city: 'Nairobi',
      capacity: 200,
      price: 0,
      image: 'https://picsum.photos/seed/burify-cancelled/800/400',
      organizer: organizer._id,
      status: 'cancelled',
      visibility: 'public',
    },
    {
      title: 'Burify Past Conference',
      description: 'A past event used for testing history and date filtering.',
      category: 'Technology',
      date: pastDate,
      time: '09:00',
      location: 'Convention Center',
      city: 'Nairobi',
      capacity: 150,
      price: 0,
      image: 'https://picsum.photos/seed/burify-past/800/400',
      organizer: organizer._id,
      status: 'published',
      visibility: 'public',
    },
  ]);

  await Registration.create({
    user: attendee._id,
    event: events[0]._id,
    ticketNumber: 'EVT-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
    status: 'confirmed',
  });

  console.log('Seed data created successfully');
  console.log('Users:', { admin: admin.email, organizer: organizer.email, attendee: attendee.email });
  console.log('Password for all test users: TestPass123!');
  console.log('Events created:', events.length);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
