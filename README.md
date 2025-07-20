# Pixeliy - Decentralized Real-Time Communication Platform

Pixeliy is a decentralized real-time communication (dRTC) platform built on the Internet Computer Protocol (ICP). Pixeliy allows users to create and join peer-to-peer video meeting rooms without a central server, with a fully decentralized signaling, identity, and communication system.

## Features

- **Decentralized Architecture**: Built on Internet Computer Protocol (ICP) for true decentralization
- **Internet Identity Authentication**: Secure, privacy-preserving authentication using Internet Identity
- **Peer-to-Peer Video Calls**: Direct WebRTC connections between participants
- **Real-Time Room Management**: Dynamic participant tracking and room state synchronization
- **Device Control**: Camera and microphone management with device selection
- **Responsive Design**: Modern UI with Tailwind CSS and Framer Motion animations
- **TypeScript Support**: Full type safety across frontend and backend

## Architecture

### Backend (Motoko)
- **User Service**: Handle user authentication and profile management
- **Room Service**: Manage room creation, joining, and participant tracking
- **Signal Service**: WebRTC signaling coordination for peer connections
- **Internet Identity Integration**: Decentralized authentication

### Frontend (React + TypeScript)
- **React Router**: Navigation between Home, Profile, Dashboard, and Room pages
- **WebRTC Integration**: Peer-to-peer video communication
- **Real-time Hooks**: Custom hooks for room state and authentication
- **Device Management**: Camera/microphone selection and control

## Tech Stack

- **Backend**: Motoko (Internet Computer)
- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Authentication**: Internet Identity
- **Communication**: WebRTC for peer-to-peer connections

## Getting Started

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

### License
This project is licensed under the MIT License - see the LICENSE file for details.