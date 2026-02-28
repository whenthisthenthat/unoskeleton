import { AutoLockTimer } from "@/lib/vault/auto-lock-timer";

const mockRemove = jest.fn();
let appStateHandler: ((state: string) => void) | null = null;

jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn(
      (_type: string, handler: (state: string) => void) => {
        appStateHandler = handler;
        return { remove: mockRemove };
      },
    ),
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
  appStateHandler = null;
  mockRemove.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("AutoLockTimer", () => {
  it("does not start timer or add listener on construction", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require("react-native");
    const onLock = jest.fn();
    new AutoLockTimer(60_000, onLock);

    expect(AppState.addEventListener).not.toHaveBeenCalled();
    jest.advanceTimersByTime(60_000);
    expect(onLock).not.toHaveBeenCalled();
  });

  it("start() adds AppState listener and starts timer", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require("react-native");
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    expect(AppState.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    expect(appStateHandler).not.toBeNull();
  });

  it("fires onLock after configured timeout", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    jest.advanceTimersByTime(59_999);
    expect(onLock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("resetTimer() restarts the countdown", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    jest.advanceTimersByTime(50_000);
    timer.resetTimer();

    jest.advanceTimersByTime(50_000);
    expect(onLock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10_000);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("AppState background fires onLock immediately", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    appStateHandler!("background");
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("AppState inactive fires onLock immediately", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    appStateHandler!("inactive");
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("AppState active resets the timer", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    jest.advanceTimersByTime(50_000);
    appStateHandler!("active");

    jest.advanceTimersByTime(59_999);
    expect(onLock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("stop() clears timer and removes AppState listener", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();
    timer.stop();

    jest.advanceTimersByTime(120_000);
    expect(onLock).not.toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("updateTimeout() restarts timer with new value", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    timer.updateTimeout(30_000);

    jest.advanceTimersByTime(29_999);
    expect(onLock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("null timeout disables timer and AppState lock", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(null, onLock);
    timer.start();

    jest.advanceTimersByTime(600_000);
    expect(onLock).not.toHaveBeenCalled();

    appStateHandler!("background");
    expect(onLock).not.toHaveBeenCalled();

    appStateHandler!("inactive");
    expect(onLock).not.toHaveBeenCalled();
  });

  it("pause() clears timer — onLock does not fire while paused", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    jest.advanceTimersByTime(30_000);
    timer.pause();

    jest.advanceTimersByTime(120_000);
    expect(onLock).not.toHaveBeenCalled();
  });

  it("resume() restarts countdown from zero", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    timer.pause();
    jest.advanceTimersByTime(120_000);

    timer.resume();

    jest.advanceTimersByTime(59_999);
    expect(onLock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("resetTimer() is a no-op while paused", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();
    timer.pause();

    timer.resetTimer();

    jest.advanceTimersByTime(120_000);
    expect(onLock).not.toHaveBeenCalled();
  });

  it("multiple resetTimer() calls only keep one active timer", () => {
    const onLock = jest.fn();
    const timer = new AutoLockTimer(60_000, onLock);
    timer.start();

    timer.resetTimer();
    timer.resetTimer();
    timer.resetTimer();

    jest.advanceTimersByTime(60_000);
    expect(onLock).toHaveBeenCalledTimes(1);
  });
});
