import { Data } from "effect";

export class LessonNotFoundError extends Data.TaggedError("LessonNotFoundError")<{
  readonly lessonId: string;
}> {
  override get message(): string {
    return `La lección "${this.lessonId}" no existe en el curso.`;
  }
}

export class InvalidRequestError extends Data.TaggedError("InvalidRequestError")<{
  readonly detail: string;
}> {
  override get message(): string {
    return this.detail;
  }
}
