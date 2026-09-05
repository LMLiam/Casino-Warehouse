export class BeatTableStatusView {
  public constructor(private readonly status: HTMLElement) {}

  public show(message: string): void {
    this.status.textContent = message;
    this.status.classList.toggle('hidden', message.length === 0);
  }

  public clear(): void {
    this.status.textContent = '';
    this.status.classList.toggle('hidden', true);
  }

  public setVisible(visible: boolean): void {
    const hasMessage = (this.status.textContent ?? '').length > 0;
    this.status.classList.toggle('hidden', !visible || !hasMessage);
  }
}
