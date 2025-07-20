import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Int "mo:base/Int";

module {
    public type Users = HashMap.HashMap<Principal, User>;
    public type Rooms = HashMap.HashMap<Text, Room>;
    public type Signals = HashMap.HashMap<Text, [Signal]>;

    public type User = {
        id : Principal;
        username : Text;
        name : ?Text;
        createdAt : Int;
        profilePicture : ?Text;
    };

    public type UserUpdateData = {
        username : ?Text;
        name : ?Text;
        profilePicture : ?Text;
    };

    public type Room = {
        id : Text;
        host : Principal;
        participants : [Principal];
        createdAt : Int;
    };

    public type Signal = {
        from : Principal;
        to : Principal;
        kind : Text; // "offer", "answer", "ice"
        data : Text;
    };
};
