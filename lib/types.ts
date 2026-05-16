export type Lesson = { id: string; title: string; position: number; pass_score: number; module_id: string; };
export type Question = { id: string; lesson_id: string; prompt: string; explanation: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: 'A' | 'B' | 'C' | 'D'; position: number; };
