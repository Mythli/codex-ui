import { useEffect, useMemo, type ReactNode } from "react";
import { Provider } from "react-redux";
import { getCodexTransportController } from "../adapters/codexTransport";
import { codexTrafficReceived } from "./actions/codexTrafficActions";
import { coderStore, createCoderStore, type AppStore } from "./index";
import {
  codexSocketClosed,
  codexSocketConnected,
  codexSocketConnecting,
  codexSocketDisconnected,
  codexSocketFailed
} from "./slices/codexConnectionSlice";
import { refreshThreadIndex } from "./thunks/threadThunks";
import { loadConfig, loadModels } from "./thunks/modelsConfigThunks";

export function CoderReduxProvider({
  children,
  store
}: {
  children: ReactNode;
  store?: AppStore;
}) {
  const effectiveStore = useMemo(() => store ?? coderStore ?? createCoderStore(), [store]);

  return (
    <Provider store={effectiveStore}>
      <CodexTransportBinder store={effectiveStore} />
      {children}
    </Provider>
  );
}

function CodexTransportBinder({ store }: { store: AppStore }) {
  useEffect(() => {
    const { socket, transport } = getCodexTransportController();
    const dispatch = store.dispatch;
    dispatch(codexSocketConnecting());

    const unsubscribeTraffic = transport.onTraffic((traffic) => {
      dispatch(codexTrafficReceived(traffic));
    });
    const onConnect = () => {
      dispatch(codexSocketConnected());
    };
    const onDisconnect = (reason: string) => {
      dispatch(codexSocketDisconnected(reason));
    };
    const onConnectError = (error: Error) => {
      dispatch(codexSocketFailed(error.message));
    };
    const onClosed = (payload?: { exitCode: number | null; signal: string | null }) => {
      dispatch(codexSocketClosed(payload));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("closed", onClosed);

    void dispatch(refreshThreadIndex());
    void dispatch(loadModels());
    void dispatch(loadConfig());

    return () => {
      unsubscribeTraffic();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("closed", onClosed);
    };
  }, [store]);

  return null;
}
