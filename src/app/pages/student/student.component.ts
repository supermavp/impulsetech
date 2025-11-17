import { Component, inject, signal, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseService, Course, Lesson, CourseEnrollment, LessonCompletion, Quiz, QuizSubmission } from '../../services/course.service';
import { MarkdownService } from '../../services/markdown.service';
import { User } from '@angular/fire/auth';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './student.component.html',
  styleUrl: './student.component.css',
  encapsulation: ViewEncapsulation.None
})
export class StudentComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private markdownService = inject(MarkdownService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  
  currentUser = signal<User | null>(null);
  userData = signal<any>(null);
  courses = signal<Course[]>([]);
  enrollments = signal<CourseEnrollment[]>([]);
  selectedCourse = signal<Course | null>(null);
  selectedLesson = signal<Lesson | null>(null);
  lessons = signal<Lesson[]>([]);
  completedLessons = signal<LessonCompletion[]>([]);
  quizzes = signal<Quiz[]>([]);
  quizSubmissions = signal<QuizSubmission[]>([]);
  
  showAvailableCourses = signal(true);
  selectedQuiz = signal<Quiz | null>(null);
  showQuiz = signal(false);
  showQuizResults = signal(false);
  currentQuizSubmission: any = signal<QuizSubmission | null>(null);
  quizForm: FormGroup;

  constructor() {
    this.quizForm = this.fb.group({});
  }

  ngOnInit() {
    this.authService.user$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser.set(user);
      if (!user) {
        // Cancelar todas las suscripciones cuando el usuario se desautentica
        this.destroy$.next();
        this.router.navigate(['/login']);
      } else {
        this.loadUserData();
        this.loadCourses();
        this.loadEnrollments();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUserData() {
    const userData = this.authService.currentUserData();
    this.userData.set(userData);
  }

  loadCourses() {
    this.courseService.getCourses$().pipe(
      takeUntil(this.destroy$)
    ).subscribe(courses => {
      this.courses.set(courses);
    });
  }

  loadEnrollments() {
    const user = this.currentUser();
    if (user) {
      this.courseService.getEnrollmentsByStudent$(user.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(enrollments => {
        this.enrollments.set(enrollments);
      });
    }
  }

  async enrollInCourse(courseId: string) {
    const user = this.currentUser();
    if (!user || !courseId) return;

    try {
      const course = await this.courseService.getCourse(courseId);
      if (!course) return;

      await this.courseService.enrollStudent(
        courseId,
        user.uid,
        user.displayName || user.email || 'Estudiante'
      );
      
      this.loadEnrollments();
    } catch (error: any) {
      if (error.message === 'Ya estás inscrito en este curso') {
        alert('Ya estás inscrito en este curso');
      } else {
        console.error('Error al inscribirse:', error);
      }
    }
  }

  isEnrolled(courseId?: string): boolean {
    if (!courseId) return false;
    return this.enrollments().some(e => e.courseId === courseId);
  }

  getEnrollmentGrade(courseId?: string): number | undefined {
    if (!courseId) return undefined;
    const enrollment = this.enrollments().find(e => e.courseId === courseId);
    return enrollment?.grade;
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  async selectCourse(course: Course) {
    this.selectedCourse.set(course);
    const user = this.currentUser();
    if (course.id && user) {
      this.courseService.getLessonsByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(lessons => {
        this.lessons.set(lessons);
      });
      
      // Cargar lecciones completadas
      this.courseService.getCompletedLessons$(course.id, user.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(completions => {
        this.completedLessons.set(completions);
      });

      // Cargar evaluaciones
      this.courseService.getQuizzesByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(quizzes => {
        this.quizzes.set(quizzes);
      });

      // Cargar respuestas a evaluaciones
      this.courseService.getQuizSubmissionsByStudent$(course.id, user.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(submissions => {
        this.quizSubmissions.set(submissions);
      });
    }
  }

  async completeLesson(lessonId: string) {
    const user = this.currentUser();
    const course = this.selectedCourse();
    
    if (!user || !course || !course.id) return;

    if (!this.isEnrolled(course.id)) {
      alert('Debes estar inscrito en el curso para completar lecciones');
      return;
    }

    try {
      await this.courseService.completeLesson(lessonId, course.id, user.uid);
      // Las lecciones completadas se actualizarán automáticamente por el observable
      this.loadEnrollments(); // Recargar para actualizar el progreso
    } catch (error) {
      console.error('Error al completar lección:', error);
      alert('Error al marcar la lección como completada');
    }
  }

  isLessonCompleted(lessonId?: string): boolean {
    if (!lessonId) return false;
    return this.completedLessons().some(c => c.lessonId === lessonId);
  }

  async startQuiz(quiz: Quiz) {
    const user = this.currentUser();
    const course = this.selectedCourse();
    
    if (!user || !course || !course.id) return;

    if (!this.isEnrolled(course.id)) {
      alert('Debes estar inscrito en el curso para presentar evaluaciones');
      return;
    }

    // Verificar si ya presentó la evaluación
    const existingSubmission = await this.courseService.getQuizSubmission(quiz.id!, user.uid);
    if (existingSubmission) {
      this.currentQuizSubmission.set(existingSubmission);
      this.showQuizResults.set(true);
      return;
    }

    this.selectedQuiz.set(quiz);
    
    // Crear formulario dinámico para las preguntas
    const formControls: any = {};
    quiz.questions.forEach((question, index) => {
      const key = question.id || index.toString();
      formControls[key] = ['', Validators.required];
    });
    this.quizForm = this.fb.group(formControls);
    
    this.showQuiz.set(true);
  }

  async submitQuiz() {
    if (this.quizForm.invalid) {
      alert('Por favor responde todas las preguntas');
      return;
    }

    const user = this.currentUser();
    const course = this.selectedCourse();
    const quiz = this.selectedQuiz();
    
    if (!user || !course || !course.id || !quiz || !quiz.id) return;

    try {
      const answers: Record<string, string | number> = {};
      Object.keys(this.quizForm.value).forEach(key => {
        const value = this.quizForm.value[key];
        // Convertir a número si es múltiple opción
        const question = quiz.questions.find(q => (q.id || quiz.questions.indexOf(q).toString()) === key);
        if (question?.type === 'multiple-choice') {
          answers[key] = parseInt(value);
        } else {
          answers[key] = value;
        }
      });

      const submissionId = await this.courseService.submitQuiz(
        quiz.id,
        course.id,
        user.uid,
        user.displayName || user.email || 'Estudiante',
        answers
      );

      // Obtener la respuesta calificada
      const submission = await this.courseService.getQuizSubmission(quiz.id, user.uid);
      this.currentQuizSubmission.set(submission);
      
      this.showQuiz.set(false);
      this.showQuizResults.set(true);
      
      // Recargar respuestas
      this.courseService.getQuizSubmissionsByStudent$(course.id, user.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(submissions => {
        this.quizSubmissions.set(submissions);
      });
    } catch (error) {
      console.error('Error al presentar evaluación:', error);
      alert('Error al presentar la evaluación');
    }
  }

  getQuizSubmission(quizId?: string): QuizSubmission | undefined {
    if (!quizId) return undefined;
    return this.quizSubmissions().find(s => s.quizId === quizId);
  }

  closeQuiz() {
    this.selectedQuiz.set(null);
    this.showQuiz.set(false);
    this.showQuizResults.set(false);
    this.currentQuizSubmission.set(null);
    this.quizForm = this.fb.group({});
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    return user?.displayName || user?.email || 'Estudiante';
  }

  /**
   * Selecciona una lección para verla a pantalla completa
   */
  selectLesson(lesson: Lesson) {
    this.selectedLesson.set(lesson);
  }

  /**
   * Cierra la vista de lección y vuelve al curso
   */
  closeLesson() {
    this.selectedLesson.set(null);
  }

  /**
   * Convierte Markdown a HTML sanitizado para renderizar en el template
   */
  renderMarkdown(markdown: string | null | undefined): SafeHtml {
    return this.markdownService.toHtml(markdown);
  }

  // Obtener puntos obtenidos para una pregunta específica
  getQuestionPoints(question: any, questionIndex: number): number {
    const submission = this.currentQuizSubmission();
    if (!submission || !submission.answers) return 0;

    const questionKey = question.id || questionIndex.toString();
    const studentAnswer = submission.answers[questionKey];

    if (question.type === 'multiple-choice') {
      const correctAnswerNum = typeof question.correctAnswer === 'number' 
        ? question.correctAnswer 
        : parseInt(question.correctAnswer.toString());
      
      const studentAnswerNum = typeof studentAnswer === 'number' 
        ? studentAnswer 
        : (studentAnswer ? parseInt(studentAnswer.toString()) : -1);
      
      return studentAnswerNum === correctAnswerNum ? question.points : 0;
    } else {
      // Tipo texto
      if (!studentAnswer) return 0;
      const studentAnsStr = studentAnswer.toString().toLowerCase().trim();
      const correctAnsStr = question.correctAnswer.toString().toLowerCase().trim();
      return studentAnsStr === correctAnsStr ? question.points : 0;
    }
  }

  // Verificar si una opción es la respuesta correcta (para múltiple opción)
  isCorrectOption(question: any, optionIndex: number): boolean {
    const correctAnswerNum = typeof question.correctAnswer === 'number' 
      ? question.correctAnswer 
      : parseInt(question.correctAnswer.toString());
    return optionIndex === correctAnswerNum;
  }

  // Verificar si una opción fue seleccionada por el estudiante
  isSelectedOption(question: any, questionIndex: number, optionIndex: number): boolean {
    const submission = this.currentQuizSubmission();
    if (!submission || !submission.answers) return false;

    const questionKey = question.id || questionIndex.toString();
    const studentAnswer = submission.answers[questionKey];
    
    const studentAnswerNum = typeof studentAnswer === 'number' 
      ? studentAnswer 
      : (studentAnswer ? parseInt(studentAnswer.toString()) : -1);
    
    return optionIndex === studentAnswerNum;
  }

  // Obtener respuesta del estudiante como número (para múltiple opción)
  getStudentAnswerAsNumber(question: any, questionIndex: number): number {
    const submission = this.currentQuizSubmission();
    if (!submission || !submission.answers) return -1;

    const questionKey = question.id || questionIndex.toString();
    const studentAnswer = submission.answers[questionKey];
    
    return typeof studentAnswer === 'number' 
      ? studentAnswer 
      : (studentAnswer ? parseInt(studentAnswer.toString()) : -1);
  }

  // Obtener respuesta correcta como número (para múltiple opción)
  getCorrectAnswerAsNumber(question: any): number {
    return typeof question.correctAnswer === 'number' 
      ? question.correctAnswer 
      : parseInt(question.correctAnswer.toString());
  }
}

