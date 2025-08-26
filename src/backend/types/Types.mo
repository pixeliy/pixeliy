import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Int "mo:base/Int";

module {
  public type Users = HashMap.HashMap<Principal, User>;
  public type Rooms = HashMap.HashMap<Text, Room>;
  public type Signals = HashMap.HashMap<Text, [Signal]>;

  // === OUTFIT TYPES ===
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

  // === RTC payloads ===
  public type Ice = {
    candidate : Text;
    sdpMid : ?Text;
    sdpMLineIndex : ?Nat32;
  };

  public type RtcPayload = {
    #Offer : Text; // SDP (offer.sdp)
    #Answer : Text; // SDP (answer.sdp)
    #Ice : Ice; // ICE candidate
  };

  // WS message types
  public type WsMessage = {
    #Subscribe : { roomId : Text };
    #Unsubscribe : { roomId : Text };
    #RoomJoin : { roomId : Text };
    #RoomLeave : { roomId : Text };
    #Participants : { roomId : Text; participants : [Principal] };
    #Joined : { roomId : Text; who : Principal };
    #Left : { roomId : Text; who : Principal };
    #Subscribed : { roomId : Text; who : Principal };
    #RtcSend : { roomId : Text; to : Principal; payload : RtcPayload };
    #RtcFrom : { roomId : Text; from : Principal; payload : RtcPayload };
    #RtcHello : { roomId : Text }; // client -> canister
    #RtcHelloFrom : { roomId : Text; from : Principal }; // canister -> clients
    #Ping : { ts : Nat64 };
    #Pong : { ts : Nat64 };
    #Error : Text;
  };
};
