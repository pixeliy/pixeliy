# Pixeliy - Decentralized Real-Time Communication Platform

**Website:** [https://pixeliy.com](https://pixeliy.com)

Pixeliy is a decentralized real-time communication (dRTC) platform built on the Internet Computer Protocol (ICP). Pixeliy allows users to create and join peer-to-peer video meeting rooms without a central server, with a fully decentralized signaling, identity, and communication system.

---

## 🚀 Key Features

-  **Decentralized Identity** with Internet Identity (II)
-  **Peer-to-Peer Video Calls** via WebRTC with on-chain signaling
-  **AI Translator (Beta)** for real-time multilingual meetings
-  **Modular Architecture** with Motoko + React/TypeScript
-  **Modern UI** with TailwindCSS and Framer Motion
-  **Smart Room Management** and state synchronization

---

## 🛠 Architecture Overview

### Backend (Motoko)
- **UserService**: Auth & user profile on-chain
- **RoomService**: Create, join, and manage video rooms
- **SignalService**: WebRTC signaling (offers/answers/ICE) via canister
- **ICP Authentication**: Seamless auth with Internet Identity
- **MOPS Package Manager**: Dependency & module management

### Frontend (React + TypeScript)
- **Internet Identity login**
- **Custom Hooks**: `useAuth`, `useRoom`, `useSignal`
- **WebRTC integration** with real-time peer connection logic
- **Tailwind CSS** UI, framer motion transitions
- **Dynamic routing** via React Router

---

## 📈 Roadmap

### Q3 2025 (Completed)
- Core P2P Communication  
- End-to-End Encryption  
- Smart Room Creation  
- Cross-Platform Support  

### Q3 2025 (In Progress)
- Real-Time AI Translation (100+ languages)  
- AI Agent Assistant  
- Smart Meeting Summaries  
- Intelligent Scheduling  

### Q4 2025+
- Tokenization (PIXL token, rewards)  
- Immersive AI Avatars  
- Custom Agent Personalization  
- NFT Marketplace for Digital Assets  

---

## 💻 Local Development

### Prerequisites

Make sure you have the following installed:
- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install) (Internet Computer SDK)
- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/pixeliy/pixeliy.git pixeliy
   cd pixeliy
   ```

2. **Install dependencies**
    ```bash
    # Install frontend dependencies
    cd src/frontend
    npm install
    cd ../..
    ```

### Running the Project Locally

1. **Start the local Internet Computer replica**
   ```bash
   # Starts the replica, running in the background
   dfx start --clean --background
   ```

2. **Deploy the canisters**
   ```bash
   # Deploys your canisters to the replica and generates your candid interface
   dfx deploy
   ```

3. **Access the application**
    Once the job completes, your application will be available at http://localhost:4943?canisterId={asset_canister_id}.

### Development Commands
   ```bash
   # Get help with DFX commands
   dfx help
   dfx canister --help

   # Check canister status
   dfx canister status --all

   # View canister logs
   dfx canister logs backend

   # Reset local state (use with caution)
   dfx start --clean
   ```

---

### License
This project is licensed under the MIT License - see the LICENSE file for details.
