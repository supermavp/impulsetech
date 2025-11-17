import { Component, inject, signal, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CourseService, Course, Lesson, Quiz, QuizQuestion } from '../../services/course.service';
import { MarkdownService } from '../../services/markdown.service';
import { User } from '@angular/fire/auth';
import { SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './teacher.component.html',
  styleUrl: './teacher.component.css',
  encapsulation: ViewEncapsulation.None
})
export class TeacherComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private courseService = inject(CourseService);
  private markdownService = inject(MarkdownService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  
  currentUser = signal<User | null>(null);
  userData = signal<any>(null);
  courses = signal<Course[]>([]);
  selectedCourse = signal<Course | null>(null);
  enrollments = signal<any[]>([]);
  lessons = signal<Lesson[]>([]);
  
  showCreateCourse = signal(false);
  showCreateLesson = signal(false);
  selectedLesson = signal<Lesson | null>(null);
  viewingLesson = signal(false); // Para vista a pantalla completa
  showEditLesson = signal(false);
  showCreateQuiz = signal(false);
  showEditQuiz = signal(false);
  selectedQuiz = signal<Quiz | null>(null);
  quizzes = signal<Quiz[]>([]);
  
  courseForm: FormGroup;
  lessonForm: FormGroup;
  quizForm: FormGroup;
  quizQuestions: any = signal<QuizQuestion[]>([]);

  constructor() {
    this.courseForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]]
    });

    this.lessonForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      content: ['', [Validators.required, Validators.minLength(20)]],
      order: [1, [Validators.required, Validators.min(1)]]
    });

    this.quizForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      passingScore: [60, [Validators.required, Validators.min(0), Validators.max(100)]],
      timeLimit: [null]
    });
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
    const user = this.currentUser();
    if (user) {
      this.courseService.getCoursesByTeacher$(user.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(courses => {
        this.courses.set(courses);
      });
    }
  }

  async createCourse() {
    if (this.courseForm.invalid) {
      this.markFormGroupTouched(this.courseForm);
      return;
    }

    const user = this.currentUser();
    if (!user) return;

    try {
      const { title, description } = this.courseForm.value;
      await this.courseService.createCourse({
        title,
        description,
        teacherId: user.uid,
        teacherName: user.displayName || user.email || 'Profesor',
        isActive: true
      });
      
      this.courseForm.reset();
      this.showCreateCourse.set(false);
      this.loadCourses();
    } catch (error) {
      console.error('Error al crear curso:', error);
    }
  }

  async createLesson() {
    if (this.lessonForm.invalid) {
      this.markFormGroupTouched(this.lessonForm);
      return;
    }

    const course = this.selectedCourse();
    if (!course || !course.id) return;

    try {
      const { title, description, content, order } = this.lessonForm.value;
      await this.courseService.createLesson({
        courseId: course.id,
        title,
        description,
        content,
        order
      });
      
      this.lessonForm.reset({ order: 1 });
      this.showCreateLesson.set(false);
      
      // Recargar lecciones
      this.courseService.getLessonsByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(lessons => {
        this.lessons.set(lessons);
      });
    } catch (error) {
      console.error('Error al crear lección:', error);
    }
  }

  async updateLesson() {
    if (this.lessonForm.invalid) {
      this.markFormGroupTouched(this.lessonForm);
      return;
    }

    const lesson = this.selectedLesson();
    if (!lesson || !lesson.id) return;

    try {
      const { title, description, content, order } = this.lessonForm.value;
      await this.courseService.updateLesson(lesson.id, {
        title,
        description,
        content,
        order
      });
      
      this.lessonForm.reset({ order: 1 });
      this.showEditLesson.set(false);
      this.selectedLesson.set(null);
      
      // Recargar lecciones
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getLessonsByCourse$(course.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(lessons => {
          this.lessons.set(lessons);
        });
      }
    } catch (error) {
      console.error('Error al actualizar lección:', error);
    }
  }

  async deleteLesson(lessonId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta lección?')) {
      return;
    }

    try {
      await this.courseService.deleteLesson(lessonId);
      
      // Recargar lecciones
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getLessonsByCourse$(course.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(lessons => {
          this.lessons.set(lessons);
        });
      }
    } catch (error) {
      console.error('Error al eliminar lección:', error);
      alert('Error al eliminar lección. Verifica los permisos.');
    }
  }

  /**
   * Ver lección a pantalla completa (no modal)
   */
  viewLesson(lesson: Lesson) {
    this.selectedLesson.set(lesson);
    this.viewingLesson.set(true);
  }

  /**
   * Cierra la vista de lección y vuelve al curso
   */
  closeLesson() {
    this.selectedLesson.set(null);
    this.viewingLesson.set(false);
  }

  editLesson(lesson: Lesson) {
    this.selectedLesson.set(lesson);
    this.lessonForm.patchValue({
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      order: lesson.order
    });
    this.showEditLesson.set(true);
  }

  cancelEditLesson() {
    this.selectedLesson.set(null);
    this.showEditLesson.set(false);
    this.lessonForm.reset({ order: 1 });
  }

  // ========== EVALUACIONES ==========

  addQuizQuestion() {
    const questions = this.quizQuestions();
    const newQuestion: QuizQuestion = {
      question: '',
      type: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1
    };
    this.quizQuestions.set([...questions, newQuestion]);
  }

  removeQuizQuestion(index: number) {
    const questions = this.quizQuestions();
    questions.splice(index, 1);
    this.quizQuestions.set([...questions]);
  }

  updateQuestionType(index: number, type: 'multiple-choice' | 'text') {
    const questions = this.quizQuestions();
    questions[index].type = type;
    if (type === 'text') {
      questions[index].options = undefined;
    } else {
      questions[index].options = ['', '', '', ''];
    }
    this.quizQuestions.set([...questions]);
  }

  async createQuiz() {
    if (this.quizForm.invalid) {
      this.markFormGroupTouched(this.quizForm);
      return;
    }

    const questions = this.quizQuestions();
    if (questions.length === 0) {
      alert('Debes agregar al menos una pregunta');
      return;
    }

    // Validar preguntas
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || q.question.trim() === '') {
        alert(`La pregunta ${i + 1} está vacía`);
        return;
      }
      if (q.points <= 0) {
        alert(`La pregunta ${i + 1} debe tener al menos 1 punto`);
        return;
      }
      if (q.type === 'multiple-choice') {
        if (!q.options || q.options.filter((o: string) => o.trim() !== '').length < 2) {
          alert(`La pregunta ${i + 1} debe tener al menos 2 opciones`);
          return;
        }
        const correctAnswerNum = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseInt(q.correctAnswer.toString());
        if (isNaN(correctAnswerNum) || correctAnswerNum < 0 || correctAnswerNum >= q.options.length) {
          alert(`La pregunta ${i + 1} tiene una respuesta correcta inválida`);
          return;
        }
      } else {
        if (!q.correctAnswer || q.correctAnswer.toString().trim() === '') {
          alert(`La pregunta ${i + 1} debe tener una respuesta correcta`);
          return;
        }
      }
    }

    const course = this.selectedCourse();
    if (!course || !course.id) return;

    const quiz = this.selectedQuiz();
    const isEditing = !!quiz && !!quiz.id;

    try {
      const { title, description, passingScore, timeLimit } = this.quizForm.value;
      const questionsData = questions.map((q: QuizQuestion, index: number) => ({
        ...q,
        id: q.id || index.toString(),
        options: q.type === 'multiple-choice' ? q.options?.filter((o: string) => o.trim() !== '') : undefined
      }));

      if (isEditing) {
        // Actualizar evaluación existente
        await this.courseService.updateQuiz(quiz.id!, {
          title,
          description,
          questions: questionsData,
          passingScore: parseInt(passingScore),
          timeLimit: timeLimit ? parseInt(timeLimit) : undefined,
          isActive: true
        });
      } else {
        // Crear nueva evaluación
        await this.courseService.createQuiz({
          courseId: course.id,
          title,
          description,
          questions: questionsData,
          passingScore: parseInt(passingScore),
          timeLimit: timeLimit ? parseInt(timeLimit) : undefined,
          isActive: true
        });
      }
      
      this.quizForm.reset({ passingScore: 60 });
      this.quizQuestions.set([]);
      this.showCreateQuiz.set(false);
      this.showEditQuiz.set(false);
      this.selectedQuiz.set(null);
      
      // Recargar evaluaciones
      this.courseService.getQuizzesByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(quizzes => {
        this.quizzes.set(quizzes);
      });
    } catch (error) {
      console.error(`Error al ${isEditing ? 'actualizar' : 'crear'} evaluación:`, error);
      alert(`Error al ${isEditing ? 'actualizar' : 'crear'} la evaluación`);
    }
  }

  editQuiz(quiz: Quiz) {
    this.selectedQuiz.set(quiz);
    this.quizForm.patchValue({
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimit || null
    });
    
    // Cargar preguntas (hacer una copia profunda para no modificar el original)
    const questions = quiz.questions.map(q => ({
      ...q,
      options: q.type === 'multiple-choice' && q.options ? [...q.options] : undefined
    }));
    this.quizQuestions.set(questions);
    
    this.showEditQuiz.set(true);
  }

  cancelEditQuiz() {
    this.showEditQuiz.set(false);
    this.selectedQuiz.set(null);
    this.quizForm.reset({ passingScore: 60 });
    this.quizQuestions.set([]);
  }

  async deleteQuiz(quizId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta evaluación?')) {
      return;
    }

    try {
      await this.courseService.deleteQuiz(quizId);
      
      // Recargar evaluaciones
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getQuizzesByCourse$(course.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(quizzes => {
          this.quizzes.set(quizzes);
        });
      }
    } catch (error) {
      console.error('Error al eliminar evaluación:', error);
      alert('Error al eliminar la evaluación');
    }
  }

  cancelCreateQuiz() {
    this.showCreateQuiz.set(false);
    this.showEditQuiz.set(false);
    this.selectedQuiz.set(null);
    this.quizForm.reset({ passingScore: 60 });
    this.quizQuestions.set([]);
  }

  selectCourse(course: Course) {
    this.selectedCourse.set(course);
    this.selectedLesson.set(null);
    this.viewingLesson.set(false);
    this.showEditLesson.set(false);
    this.selectedQuiz.set(null);
    this.showEditQuiz.set(false);
    if (course.id) {
      this.courseService.getEnrollmentsByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(enrollments => {
        this.enrollments.set(enrollments);
      });
      this.courseService.getLessonsByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(lessons => {
        this.lessons.set(lessons);
      });
      this.courseService.getQuizzesByCourse$(course.id).pipe(
        takeUntil(this.destroy$)
      ).subscribe(quizzes => {
        this.quizzes.set(quizzes);
      });
    }
  }

  async updateGrade(enrollmentId: string, grade: number | string) {
    try {
      const gradeNumber = typeof grade === 'string' ? parseFloat(grade) : grade;
      if (isNaN(gradeNumber) || gradeNumber < 0 || gradeNumber > 100) {
        return;
      }
      await this.courseService.updateGrade(enrollmentId, gradeNumber);
      const course = this.selectedCourse();
      if (course?.id) {
        this.courseService.getEnrollmentsByCourse$(course.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe(enrollments => {
          this.enrollments.set(enrollments);
        });
      }
    } catch (error) {
      console.error('Error al actualizar calificación:', error);
    }
  }
  
  onGradeBlur(enrollmentId: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    if (value) {
      this.updateGrade(enrollmentId, value);
    }
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  getUserDisplayName(): string {
    const user = this.currentUser();
    return user?.displayName || user?.email || 'Profesor';
  }

  /**
   * Convierte Markdown a HTML sanitizado para renderizar en el template
   */
  renderMarkdown(markdown: string | null | undefined): SafeHtml {
    return this.markdownService.toHtml(markdown);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}

