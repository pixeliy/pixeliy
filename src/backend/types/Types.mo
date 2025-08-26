import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Int "mo:base/Int";

module {
  public type Users = HashMap.HashMap<Principal, User>;
  public type Rooms = HashMap.HashMap<Text, Room>;
  public type Signals = HashMap.HashMap<Text, [Signal]>;

  public let OUTFIT_SLOT_ORDER : [Text] = ["hair", "face", "shirt", "pants", "shoes", "hand"];
  public let OUTFIT_DEFAULT : [Text] = ["0", "0", "0", "0", "0", "0"];
  public type OutfitSlots = [Text];

  public type User = {
    id : Principal;
    username : Text;
    name : ?Text;
    createdAt : Int;
    profilePicture : ?Text;
    outfitSlots : ?OutfitSlots;
  };

  public type UserUpdateData = {
    username : ?Text;
    name : ?Text;
    profilePicture : ?Text;
    outfitSlots : ?OutfitSlots;
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
