import Types "../types/Types";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Array "mo:base/Array";

module {
    public func sendSignal(signals : Types.Signals, roomId : Text, signal : Types.Signal) {
        let current = switch (signals.get(roomId)) {
            case (?list) { list };
            case (null) { [] };
        };
        signals.put(roomId, Array.append(current, [signal]));
    };

    public func getSignals(signals : Types.Signals, roomId : Text, to : Principal) : [Types.Signal] {
        switch (signals.get(roomId)) {
            case (?list) {
                Array.filter<Types.Signal>(list, func(s) { s.to == to });
            };
            case null {
                return [];
            };
        };
    };

    public func clearSignals(signals : Types.Signals, roomId : Text, to : Principal) {
        switch (signals.get(roomId)) {
            case (?list) {
                let filtered = Array.filter<Types.Signal>(list, func(s) { s.to != to });
                signals.put(roomId, filtered);
            };
            case null {};
        };
    };
};
