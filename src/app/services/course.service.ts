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
}

