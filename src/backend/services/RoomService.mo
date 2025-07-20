import Types "../types/Types";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Array "mo:base/Array";

module {
    // Create a new room with the caller as host
    public func createRoom(rooms : Types.Rooms, roomId : Text, caller : Principal) : Result.Result<Types.Room, Text> {
        if (Principal.isAnonymous(caller)) {
            return #err("NOT_AUTHENTICATED");
        };

        if (Text.size(roomId) < 3) {
            return #err("ROOM_ID_TOO_SHORT");
        };

        if (rooms.get(roomId) != null) {
            return #err("ROOM_ID_ALREADY_EXISTS");
        };

        let newRoom : Types.Room = {
            id = roomId;
            host = caller;
            participants = [caller];
            createdAt = Time.now();
        };
        rooms.put(roomId, newRoom);
        #ok(newRoom);
    };

    // Join an existing room as participant
    public func joinRoom(rooms : Types.Rooms, roomId : Text, caller : Principal) : Result.Result<Types.Room, Text> {
        if (Principal.isAnonymous(caller)) {
            return #err("NOT_AUTHENTICATED");
        };

        switch (rooms.get(roomId)) {
            case (?room) {
                if (isParticipant(room.participants, caller)) {
                    return #ok(room);
                };

                let updatedParticipants = Array.append<Principal>(room.participants, [caller]);
                let updatedRoom : Types.Room = {
                    id = room.id;
                    host = room.host;
                    participants = updatedParticipants;
                    createdAt = room.createdAt;
                };

                rooms.put(roomId, updatedRoom);
                #ok(updatedRoom);
            };
            case null {
                #err("ROOM_NOT_FOUND");
            };
        };
    };

    // Get a room by ID (read-only)
    public func getRoom(rooms : Types.Rooms, roomId : Text) : ?Types.Room {
        rooms.get(roomId);
    };

    /// Leave a room
    public func leaveRoom(rooms : Types.Rooms, roomId : Text, caller : Principal) : Result.Result<Types.Room, Text> {
        if (Principal.isAnonymous(caller)) {
            return #err("NOT_AUTHENTICATED");
        };

        switch (rooms.get(roomId)) {
            case (?room) {
                if (not isParticipant(room.participants, caller)) {
                    return #err("NOT_IN_ROOM");
                };

                let updatedParticipants = Array.filter<Principal>(
                    room.participants,
                    func(p : Principal) : Bool {
                        p != caller;
                    },
                );
                let updatedRoom : Types.Room = {
                    id = room.id;
                    host = room.host;
                    participants = updatedParticipants;
                    createdAt = room.createdAt;
                };
                rooms.put(roomId, updatedRoom);
                #ok(updatedRoom);
            };
            case null {
                #err("ROOM_NOT_FOUND");
            };
        };
    };

    // Check if caller is in participants list
    private func isParticipant(participants : [Principal], caller : Principal) : Bool {
        for (p in participants.vals()) {
            if (p == caller) {
                return true;
            };
        };
        return false;
    };
};
