import { useEffect, useRef, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import type { CoderInitialData } from "../features/conversation/state/initialData";
import { getCodexTransportController } from "../features/connection/api/codexTransport";
import { codexTrafficReceived } from "../features/connection/state/codexTrafficActions";
import { refreshThreadIndex } from "../features/conversation/state/threadThunks";
import { hydrateCoderInitialData } from "../features/conversation/state/hydrateInitialData";
import { loadConfig, loadModels } from "../features/workspace/state/modelsConfigThunks";
import type { AppStore } from "./configureStore";
import { createCoderStoreFromInitialData } from "./initialState";
import {
  codexSocketClosed,
  codexSocketConnected,
  codexSocketConnecting,
  codexSocketDisconnected,
  codexSocketFailed
} from "../features/connection/state/codexConnectionSlice";

export function CoderReduxProvider({
  children,
  initialData,
  store
}: {
  children: ReactNode;
  initialData?: CoderInitialData;
  store?: AppStore;
}) {
  const [effectiveStore] = useState(() => store ?? createCoderStoreFromInitialData(initialData));
  const hydratedInitialDataRef = useRef<CoderInitialData | undefined>(initialData);

  useEffect(() => {
    if (initialData && hydratedInitialDataRef.current !== initialData) {
      hydrateCoderInitialData(effectiveStore.dispatch, initialData);
      hydratedInitialDataRef.current = initialData;
    }
  }, [effectiveStore, initialData]);

  return (
    <Provider store={effectiveStore} serverState={effectiveStore.getState()}>
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
