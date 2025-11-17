import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  collectionData,
  docData,
  Timestamp
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';

export interface Course {
  id?: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface Lesson {
  id?: string;
  courseId: string;
  title: string;
  description: string;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseEnrollment {
  id?: string;
  courseId: string;
  studentId: string;
  studentName: string;
  enrolledAt: Date;
  progress: number;
  grade?: number;
}

export interface LessonCompletion {
  id?: string;
  lessonId: string;
  courseId: string;
  studentId: string;
  completedAt: Date;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  type: 'multiple-choice' | 'text';
  options?: string[]; // Para múltiple opción
  correctAnswer: string | number; // Para múltiple opción es el índice, para texto es la respuesta
  points: number;
}

export interface Quiz {
  id?: string;
  courseId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  totalPoints: number;
  passingScore: number;
  timeLimit?: number; // En minutos, opcional
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface QuizSubmission {
  id?: string;
  quizId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string | number>; // questionId -> answer
  score?: number;
  percentage?: number;
  isPassed?: boolean;
  submittedAt: Date;
  gradedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // ========== CURSOS ==========
  
  // Crear un curso (Teacher/Admin)
  async createCourse(course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const courseData = {
      ...course,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const coursesRef = collection(this.firestore, 'courses');
    const docRef = await addDoc(coursesRef, courseData);
    return docRef.id;
  }

  // Actualizar un curso (Teacher/Admin)
  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    const courseRef = doc(this.firestore, 'courses', courseId);
    await updateDoc(courseRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  // Eliminar un curso (Teacher/Admin)
  async deleteCourse(courseId: string): Promise<void> {
    const courseRef = doc(this.firestore, 'courses', courseId);
    await deleteDoc(courseRef);
  }

  // Obtener un curso por ID
  async getCourse(courseId: string): Promise<Course | null> {
    const courseRef = doc(this.firestore, 'courses', courseId);
    const courseSnap = await getDoc(courseRef);
    
    if (courseSnap.exists()) {
      const data = courseSnap.data();
      return {
        id: courseSnap.id,
        ...data,
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date()
      } as Course;
    }
    return null;
  }

  // Obtener cursos como observable
  getCourses$(): Observable<Course[]> {
    const coursesRef = collection(this.firestore, 'courses');
    const q = query(coursesRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(courses => courses.map(course => ({
        ...course,
        createdAt: (course['createdAt'] as any)?.toDate() || new Date(),
        updatedAt: (course['updatedAt'] as any)?.toDate() || new Date()
      })) as Course[])
    );
  }

  // Obtener cursos de un profesor específico
  getCoursesByTeacher$(teacherId: string): Observable<Course[]> {
    const coursesRef = collection(this.firestore, 'courses');
    const q = query(
      coursesRef, 
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(courses => courses.map(course => ({
        ...course,
        createdAt: (course['createdAt'] as any)?.toDate() || new Date(),
        updatedAt: (course['updatedAt'] as any)?.toDate() || new Date()
      })) as Course[])
    );
  }

  // ========== CLASES/LECCIONES ==========

  // Crear una clase (Teacher/Admin)
  async createLesson(lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const lessonData = {
      ...lesson,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const lessonsRef = collection(this.firestore, 'lessons');
    const docRef = await addDoc(lessonsRef, lessonData);
    return docRef.id;
  }

  // Obtener clases de un curso
  getLessonsByCourse$(courseId: string): Observable<Lesson[]> {
    const lessonsRef = collection(this.firestore, 'lessons');
    const q = query(
      lessonsRef,
      where('courseId', '==', courseId),
      orderBy('order', 'asc')
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(lessons => lessons.map(lesson => ({
        ...lesson,
        createdAt: (lesson['createdAt'] as any)?.toDate() || new Date(),
        updatedAt: (lesson['updatedAt'] as any)?.toDate() || new Date()
      })) as Lesson[])
    );
  }

  // Actualizar una lección (Teacher/Admin)
  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<void> {
    const lessonRef = doc(this.firestore, 'lessons', lessonId);
    await updateDoc(lessonRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  // Eliminar una lección (Teacher/Admin)
  async deleteLesson(lessonId: string): Promise<void> {
    const lessonRef = doc(this.firestore, 'lessons', lessonId);
    await deleteDoc(lessonRef);
  }

  // ========== INSCRIPCIONES ==========

  // Inscribir estudiante a un curso
  async enrollStudent(courseId: string, studentId: string, studentName: string): Promise<string> {
    const enrollmentData: Omit<CourseEnrollment, 'id'> = {
      courseId,
      studentId,
      studentName,
      enrolledAt: new Date(),
      progress: 0
    };

    // Verificar si ya está inscrito
    const existingEnrollment = await this.getEnrollment(courseId, studentId);
    if (existingEnrollment) {
      throw new Error('Ya estás inscrito en este curso');
    }

    const enrollmentsRef = collection(this.firestore, 'enrollments');
    const docRef = await addDoc(enrollmentsRef, {
      ...enrollmentData,
      enrolledAt: Timestamp.now()
    });
    return docRef.id;
  }

  // Obtener inscripción
  async getEnrollment(courseId: string, studentId: string): Promise<CourseEnrollment | null> {
    const enrollmentsRef = collection(this.firestore, 'enrollments');
    const q = query(
      enrollmentsRef,
      where('courseId', '==', courseId),
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        enrolledAt: data['enrolledAt']?.toDate() || new Date()
      } as CourseEnrollment;
    }
    return null;
  }

  // Obtener estudiantes inscritos en un curso
  getEnrollmentsByCourse$(courseId: string): Observable<CourseEnrollment[]> {
    const enrollmentsRef = collection(this.firestore, 'enrollments');
    const q = query(
      enrollmentsRef,
      where('courseId', '==', courseId)
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(enrollments => enrollments.map(enrollment => ({
        ...enrollment,
        enrolledAt: (enrollment['enrolledAt'] as any)?.toDate() || new Date()
      })) as CourseEnrollment[])
    );
  }

  // Obtener cursos en los que está inscrito un estudiante
  getEnrollmentsByStudent$(studentId: string): Observable<CourseEnrollment[]> {
    const enrollmentsRef = collection(this.firestore, 'enrollments');
    const q = query(
      enrollmentsRef,
      where('studentId', '==', studentId)
    );
    
    return collectionData(q, { idField: 'id' }).pipe(
      map(enrollments => enrollments.map(enrollment => ({
        ...enrollment,
        enrolledAt: (enrollment['enrolledAt'] as any)?.toDate() || new Date()
      })) as CourseEnrollment[])
    );
  }

  // Actualizar calificación (Teacher/Admin)
  async updateGrade(enrollmentId: string, grade: number): Promise<void> {
    const enrollmentRef = doc(this.firestore, 'enrollments', enrollmentId);
    await updateDoc(enrollmentRef, { grade });
  }

  // Actualizar progreso
  async updateProgress(enrollmentId: string, progress: number): Promise<void> {
    const enrollmentRef = doc(this.firestore, 'enrollments', enrollmentId);
    await updateDoc(enrollmentRef, { progress });
  }

  // ========== COMPLETADO DE LECCIONES ==========

  // Marcar lección como completada
  async completeLesson(lessonId: string, courseId: string, studentId: string): Promise<string> {
    // Verificar si ya está completada
    const existingCompletion = await this.getLessonCompletion(lessonId, studentId);
    if (existingCompletion) {
      return existingCompletion.id!;
    }

    const completionData: Omit<LessonCompletion, 'id'> = {
      lessonId,
      courseId,
      studentId,
      completedAt: new Date()
    };

    const completionsRef = collection(this.firestore, 'lessonCompletions');
    const docRef = await addDoc(completionsRef, {
      ...completionData,
      completedAt: Timestamp.now()
    });

    // Actualizar progreso del curso
    await this.updateCourseProgress(courseId, studentId);

    return docRef.id;
  }

  // Obtener completado de lección
  async getLessonCompletion(lessonId: string, studentId: string): Promise<LessonCompletion | null> {
    const completionsRef = collection(this.firestore, 'lessonCompletions');
    const q = query(
      completionsRef,
      where('lessonId', '==', lessonId),
      where('studentId', '==', studentId)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        completedAt: data['completedAt']?.toDate() || new Date()
      } as LessonCompletion;
    }
    return null;
  }

  // Obtener lecciones completadas de un estudiante en un curso
  getCompletedLessons$(courseId: string, studentId: string): Observable<LessonCompletion[]> {
    const completionsRef = collection(this.firestore, 'lessonCompletions');
    const q = query(
      completionsRef,
      where('courseId', '==', courseId),
      where('studentId', '==', studentId)
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(completions => completions.map(completion => ({
        ...completion,
        completedAt: (completion['completedAt'] as any)?.toDate() || new Date()
      })) as LessonCompletion[])
    );
  }

  // Actualizar progreso del curso basado en lecciones completadas
  async updateCourseProgress(courseId: string, studentId: string): Promise<void> {
    const enrollment = await this.getEnrollment(courseId, studentId);
    if (!enrollment || !enrollment.id) return;

    // Obtener todas las lecciones del curso
    const lessonsSnapshot = await getDocs(
      query(
        collection(this.firestore, 'lessons'),
        where('courseId', '==', courseId)
      )
    );
    const totalLessons = lessonsSnapshot.size;

    if (totalLessons === 0) return;

    // Obtener lecciones completadas
    const completionsSnapshot = await getDocs(
      query(
        collection(this.firestore, 'lessonCompletions'),
        where('courseId', '==', courseId),
        where('studentId', '==', studentId)
      )
    );
    const completedLessons = completionsSnapshot.size;

    // Calcular progreso porcentual
    const progress = Math.round((completedLessons / totalLessons) * 100);
    await this.updateProgress(enrollment.id, progress);
  }

  // ========== EVALUACIONES (QUIZZES) ==========

  // Crear una evaluación (Teacher/Admin)
  async createQuiz(quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt' | 'totalPoints'>): Promise<string> {
    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);
    
    const quizData = {
      ...quiz,
      totalPoints,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const quizzesRef = collection(this.firestore, 'quizzes');
    const docRef = await addDoc(quizzesRef, quizData);
    return docRef.id;
  }

  // Actualizar una evaluación (Teacher/Admin)
  async updateQuiz(quizId: string, updates: Partial<Omit<Quiz, 'id' | 'totalPoints'>>): Promise<void> {
    const quizRef = doc(this.firestore, 'quizzes', quizId);
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    // Si se actualizan las preguntas, recalcular totalPoints
    if (updates.questions) {
      updateData.totalPoints = updates.questions.reduce((sum, q) => sum + q.points, 0);
    }

    await updateDoc(quizRef, updateData);
  }

  // Eliminar una evaluación (Teacher/Admin)
  async deleteQuiz(quizId: string): Promise<void> {
    const quizRef = doc(this.firestore, 'quizzes', quizId);
    await deleteDoc(quizRef);
  }

  // Obtener evaluaciones de un curso
  getQuizzesByCourse$(courseId: string): Observable<Quiz[]> {
    const quizzesRef = collection(this.firestore, 'quizzes');
    const q = query(
      quizzesRef,
      where('courseId', '==', courseId),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(quizzes => quizzes.map(quiz => ({
        ...quiz,
        createdAt: (quiz['createdAt'] as any)?.toDate() || new Date(),
        updatedAt: (quiz['updatedAt'] as any)?.toDate() || new Date()
      })) as Quiz[])
    );
  }

  // Obtener una evaluación por ID
  async getQuiz(quizId: string): Promise<Quiz | null> {
    const quizRef = doc(this.firestore, 'quizzes', quizId);
    const quizSnap = await getDoc(quizRef);

    if (quizSnap.exists()) {
      const data = quizSnap.data();
      return {
        id: quizSnap.id,
        ...data,
        createdAt: data['createdAt']?.toDate() || new Date(),
        updatedAt: data['updatedAt']?.toDate() || new Date()
      } as Quiz;
    }
    return null;
  }

  // Presentar una evaluación (Student)
  async submitQuiz(
    quizId: string,
    courseId: string,
    studentId: string,
    studentName: string,
    answers: Record<string, string | number>
  ): Promise<string> {
    // Obtener la evaluación
    const quiz = await this.getQuiz(quizId);
    if (!quiz) {
      throw new Error('Evaluación no encontrada');
    }

    // Calcular puntuación
    let score = 0;
    quiz.questions.forEach((question, index) => {
      const questionKey = question.id || index.toString();
      const studentAnswer = answers[questionKey];
      
      if (question.type === 'multiple-choice') {
        if (studentAnswer === question.correctAnswer) {
          score += question.points;
        }
      } else {
        // Para texto, comparar (podría mejorarse con comparación fuzzy)
        if (studentAnswer.toString().toLowerCase().trim() === question.correctAnswer.toString().toLowerCase().trim()) {
          score += question.points;
        }
      }
    });

    const percentage = Math.round((score / quiz.totalPoints) * 100);
    const isPassed = percentage >= quiz.passingScore;

    const submissionData: Omit<QuizSubmission, 'id'> = {
      quizId,
      courseId,
      studentId,
      studentName,
      answers,
      score,
      percentage,
      isPassed,
      submittedAt: new Date(),
      gradedAt: new Date()
    };

    const submissionsRef = collection(this.firestore, 'quizSubmissions');
    const docRef = await addDoc(submissionsRef, {
      ...submissionData,
      submittedAt: Timestamp.now(),
      gradedAt: Timestamp.now()
    });

    return docRef.id;
  }

  // Obtener respuestas de un estudiante a una evaluación
  async getQuizSubmission(quizId: string, studentId: string): Promise<QuizSubmission | null> {
    const submissionsRef = collection(this.firestore, 'quizSubmissions');
    const q = query(
      submissionsRef,
      where('quizId', '==', quizId),
      where('studentId', '==', studentId)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data['submittedAt']?.toDate() || new Date(),
        gradedAt: data['gradedAt']?.toDate() || new Date()
      } as QuizSubmission;
    }
    return null;
  }

  // Obtener todas las respuestas de una evaluación (Teacher/Admin)
  getQuizSubmissions$(quizId: string): Observable<QuizSubmission[]> {
    const submissionsRef = collection(this.firestore, 'quizSubmissions');
    const q = query(
      submissionsRef,
      where('quizId', '==', quizId),
      orderBy('submittedAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(submissions => submissions.map(submission => ({
        ...submission,
        submittedAt: (submission['submittedAt'] as any)?.toDate() || new Date(),
        gradedAt: (submission['gradedAt'] as any)?.toDate() || new Date()
      })) as QuizSubmission[])
    );
  }

  // Obtener respuestas de un estudiante en un curso
  getQuizSubmissionsByStudent$(courseId: string, studentId: string): Observable<QuizSubmission[]> {
    const submissionsRef = collection(this.firestore, 'quizSubmissions');
    const q = query(
      submissionsRef,
      where('courseId', '==', courseId),
      where('studentId', '==', studentId),
      orderBy('submittedAt', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(submissions => submissions.map(submission => ({
        ...submission,
        submittedAt: (submission['submittedAt'] as any)?.toDate() || new Date(),
        gradedAt: (submission['gradedAt'] as any)?.toDate() || new Date()
      })) as QuizSubmission[])
    );
  }
}

