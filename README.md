# 🎓 CampusMate

> **Your All-in-One Campus Management Platform**

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()
[![Tech Stack](https://img.shields.io/badge/stack-JavaScript%20%7C%20Bootstrap%20%7C%20Vite-orange.svg)]()

**CampusMate** is a comprehensive, privacy-focused web application designed to streamline campus life management. Built for students, coordinators, and administrators, it centralizes task management, event coordination, complaint handling, permission management, and feedback collection into a single, intuitive platform.

---

## 🎯 Problem Statement

Modern campus life involves managing multiple disconnected systems:
- **Task tracking** across different platforms
- **Event discovery** through scattered announcements
- **Complaint submission** via complex bureaucratic processes
- **Permission document** management in physical files
- **Feedback collection** with no centralized system

This fragmentation leads to:
- ❌ Information overload and missed deadlines
- ❌ Poor communication between students and administration
- ❌ Inefficient resource management
- ❌ Lack of transparency in complaint resolution
- ❌ Data privacy concerns with cloud-based solutions

---

## 💡 Our Solution

**CampusMate** provides a unified, local-first platform that:
- ✅ **Centralizes** all campus management needs in one place
- ✅ **Ensures Privacy** with 100% local browser storage
- ✅ **Enables Role-Based Access** for different user types
- ✅ **Leverages AI** for intelligent task assistance
- ✅ **Offers Real-Time Updates** with instant synchronization
- ✅ **Maintains Data Security** without external server dependencies

---

## ✨ Key Features

### 📋 Task Management
- Create, organize, and track assignments with status updates
- Filter by visibility (Public/Admin Only) and ownership
- Search and sort tasks (newest, oldest, alphabetical)
- Real-time status tracking (Pending → In Progress → Completed)

### 📅 Campus Events
- Discover and browse upcoming campus events
- View detailed event information (schedules, fees, descriptions)
- Event registration with attendance tracking
- Event management tools for coordinators and admins
- Upload event posters and manage event lifecycle

### 📢 Complaint System
- Submit complaints across categories (Academic, Infrastructure, Administrative, Other)
- Track complaint status (Pending → Under Review → Resolved)
- Like/dislike reactions for community engagement
- Admin tools for efficient complaint resolution

### 📄 Permission Letters
- Upload and manage PDF permission documents
- Search and download permission letters
- Admin-controlled document management
- Organized document repository

### 💬 Feedback System
- Submit feedback with optional star ratings (1-5)
- View feedback history and analytics
- Help improve the platform through user suggestions
- Admin dashboard for feedback insights

### 🤖 AI Assistant
- **Powered by DeepSeek R1 7B** (via Ollama)
- Context-aware assistance based on user data
- Answer questions about tasks, events, complaints, and more
- Save AI-generated responses directly as tasks
- Intelligent campus management support

---

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom styling with Bootstrap 5
- **JavaScript (ES6+)** - Modern JavaScript features
- **Bootstrap 5.3.3** - Responsive UI framework
- **Vite** - Fast build tool and dev server

### Backend & AI
- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **Ollama** - Local LLM runtime
- **DeepSeek R1 7B** - AI model for assistant

### Storage
- **LocalStorage API** - Client-side data persistence
- **JSON** - Data format

### Development Tools
- **Vite** - Build tool and development server
- **Git** - Version control

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Ollama** (for AI Assistant feature)
  - Download from [ollama.ai](https://ollama.ai)
  - Install DeepSeek R1 model: `ollama pull deepseek-r1:7b`

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/CampusMate.git
   cd CampusMate
   ```

2. **Install dependencies**
   ```bash
   cd app
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Start the AI server** (in a separate terminal)
   ```bash
   npm run ai-server
   ```
   Or manually:
   ```bash
   node ollama-proxy.js
   ```

5. **Access the application**
   - Open your browser and navigate to `http://localhost:5173` (or the port shown in terminal)
   - Create an account or log in to start using CampusMate

### Building for Production

```bash
npm run build
npm run preview
```

---

## 📖 Usage Guide

### For Students
1. **Register/Login** with your USN and college email (@bmsce.ac.in)
2. **Create Tasks** to track your assignments and to-dos
3. **Browse Events** to discover campus activities
4. **Submit Complaints** for issues you encounter
5. **Provide Feedback** to help improve the platform
6. **Use AI Assistant** for help with campus-related queries

### For Coordinators
- All student features, plus:
- **Create and Manage Events** for your club/organization
- **Track Event Registrations** and attendance
- **View Event Analytics**

### For Administrators
- All coordinator features, plus:
- **View All Tasks** regardless of visibility
- **Manage Complaints** and update their status
- **Upload Permission Documents** for students
- **Export/Import Data** for backup and migration
- **View All Feedback** and analytics

---

## 📁 Project Structure

```
CampusMate/
├── app/
│   ├── src/
│   │   ├── main.js          # Main application logic
│   │   ├── storage.js       # LocalStorage management
│   │   └── style.css        # Custom styles
│   ├── index.html           # Main HTML file
│   └── package.json         # Frontend dependencies
├── data/
│   └── storage.json         # Sample data (optional)
├── ollama-proxy.js          # AI server proxy
├── package.json             # Root dependencies
└── README.md                # This file
```

---


## 🔑 Key Highlights

### 🏆 Innovation
- **Local-First Architecture**: 100% privacy-focused with no external data storage
- **AI-Powered Assistant**: Context-aware help using DeepSeek R1 7B
- **Role-Based Access Control**: Secure multi-role system
- **Real-Time Synchronization**: Instant updates across all features

### 🔒 Security & Privacy
- All data stored locally in browser
- No external server dependencies for data storage
- Secure authentication system
- Role-based permission management

### 🎯 User Experience
- Intuitive, modern interface
- Responsive design for all devices
- Fast and lightweight
- Comprehensive FAQ section

### 📊 Scalability
- Modular architecture
- Easy to extend with new features
- Efficient data management
- Export/import capabilities

---

## 🚧 Future Enhancements

- [ ] Mobile app (React Native/Flutter)
- [ ] Real-time notifications
- [ ] Calendar integration
- [ ] Email notifications
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Offline mode with sync
- [ ] Integration with college ERP systems
- [ ] Chat/messaging system

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines
- Follow the existing code style
- Write clear commit messages
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation as needed

---

## 🙏 Acknowledgments

- **Bootstrap** for the amazing UI framework
- **Ollama** for providing local LLM capabilities
- **DeepSeek** for the powerful AI model
- **Vite** for the excellent build tool
- All contributors and testers who helped improve CampusMate

---

## 📈 Statistics

- ⭐ **Features**: 6 major modules
- 👥 **User Roles**: 3 (User, Coordinator, Admin)
- 🔒 **Privacy**: 100% local storage
- 🤖 **AI Model**: DeepSeek R1 7B
- 📦 **Dependencies**: Minimal and lightweight
- 🚀 **Performance**: Fast and responsive

---

<div align="center">

### ⭐ Star this repo if you find it helpful! ⭐

**Built with ❤️ for the campus community**

**CampusMate - Where Campus Life Meets Smart Management**

</div>

